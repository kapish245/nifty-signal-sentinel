const { createKiteClient } = require("../data/kiteClient");
const { createHistoricalDataClient } = require("../data/kiteHistorical");
const { calculateRSI } = require("../indicators/rsi");
const { calculateEmaPair } = require("../indicators/ema");
const { detectVolumeTrend } = require("../indicators/volume");
const { detectTrend } = require("../indicators/trend");
const { evaluateSignal } = require("../signals/signalEngine");

const MIN_REQUIRED_CANDLES = 50;

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function validateIndicatorPayload(indicators) {
  if (!indicators || typeof indicators !== "object" || Array.isArray(indicators)) {
    throw new Error("Indicator provider must return an object");
  }

  return indicators;
}

function createDefaultLogger() {
  return {
    warn: () => undefined,
    error: () => undefined,
  };
}

function getDefaultLookbackMinutes(interval) {
  return interval === "5minute" ? 600 : 50;
}

function deriveMockOiSignal(priceTrend) {
  if (priceTrend === "up") {
    return "long_buildup";
  }

  if (priceTrend === "down") {
    return "short_buildup";
  }

  return "neutral";
}

function createRealIndicatorProvider({
  historicalClient,
  interval = "5minute",
  lookbackMinutes = getDefaultLookbackMinutes(interval),
} = {}) {
  if (
    !historicalClient ||
    typeof historicalClient.getHistoricalCandles !== "function"
  ) {
    throw new Error(
      "historicalClient with getHistoricalCandles(symbol, interval, lookbackMinutes) is required",
    );
  }

  return async ({ symbol, ltp, ltpSnapshot }) => {
    const candles = await historicalClient.getHistoricalCandles(
      symbol,
      interval,
      lookbackMinutes,
      {
        instrumentToken: ltpSnapshot?.instrumentToken,
      },
    );

    if (candles.length < MIN_REQUIRED_CANDLES) {
      return {
        candles,
        indicators: null,
        reason: "INSUFFICIENT_DATA",
      };
    }

    const closePrices = candles.map((candle) => candle.close);
    const rsi = calculateRSI(closePrices);
    const { ema20, ema50 } = calculateEmaPair(closePrices);
    const volume = detectVolumeTrend(candles);
    const { priceTrend, emaAlignment } = detectTrend({
      price: ltp,
      ema20,
      ema50,
    });

    return {
      candles,
      indicators: {
        priceTrend,
        emaAlignment,
        rsi,
        volume,
        oiSignal: deriveMockOiSignal(priceTrend),
      },
    };
  };
}

function createSafeSignal({
  symbol,
  ltp,
  reason,
  receivedCandles = 0,
  requiredCandles = MIN_REQUIRED_CANDLES,
  logger,
  error,
} = {}) {
  if (reason === "INSUFFICIENT_DATA") {
    logger.warn(
      {
        type: "INSUFFICIENT_CANDLES",
        symbol,
        received: receivedCandles,
        required: requiredCandles,
      },
      "Insufficient candles for signal generation",
    );
  } else if (error) {
    logger.error(
      {
        error: error.message,
        symbol,
      },
      "Falling back to safe NO_TRADE signal",
    );
  }

  return {
    symbol,
    ltp,
    signal: "NO_TRADE",
    reason,
    indicators: null,
    meta: {
      receivedCandles,
      requiredCandles,
    },
  };
}

function normalizeIndicatorResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Indicator provider must return an object");
  }

  if (Array.isArray(result.candles)) {
    return {
      candles: result.candles,
      indicators: result.indicators,
      reason: result.reason,
    };
  }

  return {
    candles: null,
    indicators: validateIndicatorPayload(result),
    reason: null,
  };
}

function createSignalService({
  kiteClient,
  historicalClient,
  indicatorProvider,
  indicatorInterval = "5minute",
  lookbackMinutes = getDefaultLookbackMinutes(indicatorInterval),
  logger = createDefaultLogger(),
} = {}) {
  if (!kiteClient || typeof kiteClient.getLTP !== "function") {
    throw new Error("kiteClient with getLTP(symbol) is required");
  }

  const resolvedHistoricalClient =
    historicalClient ||
    null;
  const resolvedIndicatorProvider =
    indicatorProvider ||
    createRealIndicatorProvider({
      historicalClient: resolvedHistoricalClient,
      interval: indicatorInterval,
      lookbackMinutes,
    });

  if (typeof resolvedIndicatorProvider !== "function") {
    throw new Error("indicatorProvider must be a function");
  }

  return {
    async getSignal(symbol) {
      const normalizedSymbol = requireNonEmptyString(symbol, "Symbol");
      let ltpSnapshot;

      try {
        ltpSnapshot = await kiteClient.getLTP(normalizedSymbol);
      } catch (error) {
        logger.error(
          { error: error.message, symbol: normalizedSymbol },
          "Failed to fetch LTP for signal generation",
        );
        throw error;
      }

      if (typeof ltpSnapshot?.lastPrice !== "number") {
        throw new Error("Kite client returned an invalid LTP snapshot");
      }

      let indicators;
      let indicatorResult;

      try {
        indicatorResult = normalizeIndicatorResult(
          await resolvedIndicatorProvider({
            symbol: normalizedSymbol,
            ltp: ltpSnapshot.lastPrice,
            ltpSnapshot,
          }),
        );
      } catch (error) {
        return createSafeSignal({
          symbol: normalizedSymbol,
          ltp: ltpSnapshot.lastPrice,
          reason: "INDICATOR_ERROR",
          logger,
          error,
        });
      }

      if (
        indicatorResult.reason === "INSUFFICIENT_DATA" ||
        (Array.isArray(indicatorResult.candles) &&
          indicatorResult.candles.length < MIN_REQUIRED_CANDLES)
      ) {
        return createSafeSignal({
          symbol: normalizedSymbol,
          ltp: ltpSnapshot.lastPrice,
          reason: "INSUFFICIENT_DATA",
          receivedCandles: indicatorResult.candles?.length || 0,
          logger,
        });
      }

      indicators = validateIndicatorPayload(indicatorResult.indicators);

      return {
        symbol: normalizedSymbol,
        ltp: ltpSnapshot.lastPrice,
        indicators,
        signal: evaluateSignal(indicators),
      };
    },
  };
}

function createSignalServiceFromConfig({
  apiKey,
  accessToken,
  historicalClient,
  indicatorProvider,
  indicatorInterval,
  lookbackMinutes,
  logger,
} = {}) {
  const kiteClient = createKiteClient({
    apiKey,
    accessToken,
  });
  const resolvedHistoricalClient =
    historicalClient ||
    createHistoricalDataClient({
      apiKey,
      accessToken,
      logger,
    });

  return createSignalService({
    kiteClient,
    historicalClient: resolvedHistoricalClient,
    indicatorProvider,
    indicatorInterval,
    lookbackMinutes,
    logger,
  });
}

module.exports = {
  createSignalService,
  createSignalServiceFromConfig,
  createRealIndicatorProvider,
  deriveMockOiSignal,
  getDefaultLookbackMinutes,
  MIN_REQUIRED_CANDLES,
};
