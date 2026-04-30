const { createKiteClient } = require("../data/kiteClient");
const { createHistoricalDataClient } = require("../data/kiteHistorical");
const { evaluateSignal } = require("../signals/signalEngine");
const {
  ACTIONABLE_SIGNAL_TYPES,
  SIGNAL_TYPES,
  SignalContractBuilder,
} = require("../signals/SignalContractBuilder");
const { CandleRequirementService } = require("../market/CandleRequirementService");
const { MarketClock } = require("../market/MarketClock");
const MultiTimeframeAnalyzer = require("../engines/technical/MultiTimeframeAnalyzer");

const MIN_REQUIRED_CANDLES = 50;
const CANDLE_SUFFICIENCY_MODES = {
  STRICT: "strict",
  ADAPTIVE: "adaptive",
  DEGRADED: "degraded",
};

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
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function getDefaultLookbackMinutes(interval) {
  return interval === "5minute" ? 600 : 50;
}

function getDefaultTargetCandleCount(interval) {
  return interval === "5minute" ? 120 : 80;
}

function requireSufficiencyMode(mode) {
  const normalizedMode = requireNonEmptyString(mode, "candleSufficiencyMode").toLowerCase();
  const allowedModes = new Set(Object.values(CANDLE_SUFFICIENCY_MODES));
  if (!allowedModes.has(normalizedMode)) {
    throw new Error("candleSufficiencyMode must be one of: strict, adaptive, degraded");
  }

  return normalizedMode;
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
  targetCandleCount = getDefaultTargetCandleCount(interval),
  candleSufficiencyMode = CANDLE_SUFFICIENCY_MODES.ADAPTIVE,
  logger = createDefaultLogger(),
  candleRequirementService = new CandleRequirementService(),
  marketClock = new MarketClock(),
  multiTimeframeAnalyzer = new MultiTimeframeAnalyzer(),
} = {}) {
  const normalizedMode = requireSufficiencyMode(candleSufficiencyMode);
  const hasLookbackFetch = typeof historicalClient?.getHistoricalCandles === "function";
  const hasCountFetch = typeof historicalClient?.getHistoricalCandlesByCount === "function";

  if (!hasLookbackFetch && (normalizedMode === CANDLE_SUFFICIENCY_MODES.STRICT || !hasCountFetch)) {
    throw new Error(
      "historicalClient with getHistoricalCandles or getHistoricalCandlesByCount is required",
    );
  }

  async function fetchCandlesForInterval({ symbol, intervalToFetch, targetCount, options }) {
    if (
      normalizedMode !== CANDLE_SUFFICIENCY_MODES.STRICT &&
      typeof historicalClient.getHistoricalCandlesByCount === "function"
    ) {
      return historicalClient.getHistoricalCandlesByCount(symbol, intervalToFetch, targetCount, options);
    }

    return historicalClient.getHistoricalCandles(symbol, intervalToFetch, lookbackMinutes, options);
  }

  return async ({ symbol, ltp, ltpSnapshot }) => {
    const marketContext = marketClock.getMarketContext();
    const primaryCandleRequirement = candleRequirementService.getRequirement(
      interval,
      marketContext.mode,
    );
    const effectiveTargetCandleCount = targetCandleCount || primaryCandleRequirement.targetCandles;
    const requiredCandles = Math.max(primaryCandleRequirement.minimumCandles, MIN_REQUIRED_CANDLES);
    const commonOptions = {
      instrumentToken: ltpSnapshot?.instrumentToken,
      marketContext,
    };
    const frames = await fetchMultiTimeframeCandles({
      symbol,
      marketContext,
      commonOptions,
      primaryInterval: interval,
      primaryTargetCount: effectiveTargetCandleCount,
    });
    const candles = frames[interval];
    logger.debug(
      {
        symbol,
        interval,
        candleSufficiencyMode: normalizedMode,
        marketMode: marketContext.mode,
        targetCandleCount: effectiveTargetCandleCount,
        requiredCandles,
        maxLookbackMinutes: primaryCandleRequirement.maxLookbackMinutes,
        receivedCandles: candles.length,
      },
      "Fetched historical candles for signal computation",
    );

    if (candles.length < requiredCandles) {
      return {
        candles,
        indicators: null,
        reason: "INSUFFICIENT_DATA",
        meta: {
          sufficiencyMode: normalizedMode,
          marketContext,
          candleRequirement: {
            targetCandles: effectiveTargetCandleCount,
            requiredCandles,
            receivedCandles: candles.length,
          },
        },
      };
    }

    const isWarmupDegraded = candles.length < effectiveTargetCandleCount;
    const indicators = multiTimeframeAnalyzer.analyze({ frames, ltp });
    indicators.oiSignal = deriveMockOiSignal(indicators.priceTrend);

    return {
      candles,
      indicators,
      meta: {
        sufficiencyMode: normalizedMode,
        isDegraded: isWarmupDegraded,
        degradedReason: isWarmupDegraded ? "BELOW_TARGET_CANDLES" : undefined,
        confidenceCap: isWarmupDegraded ? 0.6 : undefined,
        marketContext,
        candleRequirement: {
          targetCandles: effectiveTargetCandleCount,
          requiredCandles,
          receivedCandles: candles.length,
        },
      },
    };
  };

  async function fetchMultiTimeframeCandles({
    symbol,
    marketContext,
    commonOptions,
    primaryInterval,
    primaryTargetCount,
  }) {
    const intervals = ["minute", primaryInterval, "15minute"];
    const uniqueIntervals = [...new Set(intervals)];
    const entries = await Promise.all(
      uniqueIntervals.map(async (intervalToFetch) => {
        const requirement = candleRequirementService.getRequirement(intervalToFetch, marketContext.mode);
        const targetCount = intervalToFetch === primaryInterval
          ? primaryTargetCount
          : requirement.targetCandles;
        const candles = await fetchCandlesForInterval({
          symbol,
          intervalToFetch,
          targetCount,
          options: {
            ...commonOptions,
            maxLookbackMinutes: requirement.maxLookbackMinutes,
          },
        });

        return [intervalToFetch, candles];
      }),
    );

    return Object.fromEntries(entries);
  }
}

function createSafeSignal({
  symbol,
  ltp,
  reason,
  receivedCandles = 0,
  requiredCandles = MIN_REQUIRED_CANDLES,
  logger,
  error,
  contractBuilder = new SignalContractBuilder(),
  ids = {},
  extraMeta = {},
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

  return contractBuilder.buildNoTrade({
    symbol,
    ltp,
    reason,
    meta: {
      receivedCandles,
      requiredCandles,
      ...extraMeta,
    },
    ids,
  });
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
      meta: result.meta || null,
    };
  }

  return {
    candles: null,
    indicators: validateIndicatorPayload(result),
    reason: null,
    meta: null,
  };
}

function buildSignalReason(signal, indicators) {
  if (!indicators) {
    return "Indicators unavailable";
  }

  if (signal === SIGNAL_TYPES.INTRADAY_LONG) {
    return "Bullish continuation: trend up, EMA bullish, RSI healthy, volume/oi supportive";
  }

  if (signal === SIGNAL_TYPES.INTRADAY_SHORT) {
    return "Bearish breakdown: trend down, EMA bearish, RSI weak, volume/oi supportive";
  }

  return "No high-confidence setup detected";
}

function createSignalService({
  kiteClient,
  historicalClient,
  indicatorProvider,
  indicatorInterval = "5minute",
  lookbackMinutes = getDefaultLookbackMinutes(indicatorInterval),
  targetCandleCount = getDefaultTargetCandleCount(indicatorInterval),
  candleSufficiencyMode = CANDLE_SUFFICIENCY_MODES.ADAPTIVE,
  logger = createDefaultLogger(),
  contractBuilder = new SignalContractBuilder(),
  runContext,
  candleRequirementService = new CandleRequirementService(),
  marketClock = new MarketClock(),
  enforceMarketSignalMode = false,
} = {}) {
  if (!kiteClient || typeof kiteClient.getLTP !== "function") {
    throw new Error("kiteClient with getLTP(symbol) is required");
  }

  const resolvedLogger = {
    ...createDefaultLogger(),
    ...logger,
  };
  const resolvedHistoricalClient =
    historicalClient ||
    null;
  const resolvedIndicatorProvider =
    indicatorProvider ||
    createRealIndicatorProvider({
      historicalClient: resolvedHistoricalClient,
      interval: indicatorInterval,
      lookbackMinutes,
      targetCandleCount,
      candleSufficiencyMode,
      logger: resolvedLogger,
      candleRequirementService,
      marketClock,
    });

  if (typeof resolvedIndicatorProvider !== "function") {
    throw new Error("indicatorProvider must be a function");
  }

  return {
    async getSignal(symbol, ids = {}) {
      const normalizedSymbol = requireNonEmptyString(symbol, "Symbol");
      const marketContext = marketClock.getMarketContext();
      let ltpSnapshot;

      if (enforceMarketSignalMode && !marketContext.is_trade_signal_allowed) {
        resolvedLogger.info(
          { ...ids, symbol: normalizedSymbol, marketContext },
          "Skipping intraday signal generation for current market mode",
        );
        return createSafeSignal({
          symbol: normalizedSymbol,
          ltp: null,
          reason: "MARKET_MODE_BLOCKED",
          logger: resolvedLogger,
          contractBuilder,
          ids,
          extraMeta: { marketContext },
        });
      }

      try {
        ltpSnapshot = await kiteClient.getLTP(normalizedSymbol);
      } catch (error) {
        resolvedLogger.error(
          { ...ids, error: error.message, symbol: normalizedSymbol },
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
          logger: resolvedLogger,
          error,
          contractBuilder,
          ids,
          extraMeta: { marketContext },
        });
      }

      if (
        !indicatorResult.indicators &&
        (indicatorResult.reason === "INSUFFICIENT_DATA" ||
        (Array.isArray(indicatorResult.candles) &&
          indicatorResult.candles.length < MIN_REQUIRED_CANDLES)
        )
      ) {
        return createSafeSignal({
          symbol: normalizedSymbol,
          ltp: ltpSnapshot.lastPrice,
          reason: "INSUFFICIENT_DATA",
          receivedCandles: indicatorResult.candles?.length || 0,
          requiredCandles: indicatorResult.meta?.candleRequirement?.requiredCandles || MIN_REQUIRED_CANDLES,
          logger: resolvedLogger,
          contractBuilder,
          ids,
          extraMeta: {
            marketContext: indicatorResult.meta?.marketContext || marketContext,
            candleRequirement: indicatorResult.meta?.candleRequirement,
          },
        });
      }

      indicators = validateIndicatorPayload(indicatorResult.indicators);
      const signal = evaluateSignal(indicators);
      const reason = buildSignalReason(signal, indicators);
      const signal_id = ACTIONABLE_SIGNAL_TYPES.has(signal) && runContext?.createSignalId
        ? runContext.createSignalId({ symbol: normalizedSymbol, signal_type: signal })
        : undefined;
      const signalPayload = contractBuilder.build({
        symbol: normalizedSymbol,
        ltp: ltpSnapshot.lastPrice,
        indicators,
        signal_type: signal,
        reason,
        meta: indicatorResult.meta || {},
        ids,
        signal_id,
      });
      resolvedLogger.info(
        {
          ...ids,
          signal_id,
          symbol: normalizedSymbol,
          ltp: ltpSnapshot.lastPrice,
          indicators,
          signal_type: signal,
          reason,
          meta: indicatorResult.meta,
        },
        "Signal decision completed",
      );

      return signalPayload;
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
  targetCandleCount,
  candleSufficiencyMode,
  logger,
  contractBuilder,
  runContext,
  candleRequirementService,
  marketClock,
  enforceMarketSignalMode,
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
    targetCandleCount,
    candleSufficiencyMode,
    logger,
    contractBuilder,
    runContext,
    candleRequirementService,
    marketClock,
    enforceMarketSignalMode,
  });
}

module.exports = {
  CANDLE_SUFFICIENCY_MODES,
  createSignalService,
  createSignalServiceFromConfig,
  createRealIndicatorProvider,
  deriveMockOiSignal,
  getDefaultLookbackMinutes,
  getDefaultTargetCandleCount,
  MIN_REQUIRED_CANDLES,
};
