const { createKiteClient } = require("../data/kiteClient");
const { createHistoricalDataClient } = require("../data/kiteHistorical");
const { calculateRSI } = require("../indicators/rsi");
const { calculateEmaPair } = require("../indicators/ema");
const { detectVolumeTrend } = require("../indicators/volume");
const { detectTrend } = require("../indicators/trend");
const { evaluateSignal } = require("../signals/signalEngine");

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
    error: () => undefined,
  };
}

function getDefaultLookbackMinutes(interval) {
  return interval === "5minute" ? 250 : 50;
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
      priceTrend,
      emaAlignment,
      rsi,
      volume,
      oiSignal: deriveMockOiSignal(priceTrend),
    };
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

      try {
        indicators = validateIndicatorPayload(
          await resolvedIndicatorProvider({
            symbol: normalizedSymbol,
            ltp: ltpSnapshot.lastPrice,
            ltpSnapshot,
          }),
        );
      } catch (error) {
        logger.error(
          { error: error.message, symbol: normalizedSymbol },
          "Failed to compute signal indicators",
        );
        throw new Error(`Failed to compute indicators: ${error.message}`);
      }

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
};
