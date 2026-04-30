const {
  CANDLE_SUFFICIENCY_MODES,
  createSignalService,
  MIN_REQUIRED_CANDLES,
} = require("../src/services/signalService");
const { logTestCase } = require("./utils/testCaseLogger");

function buildCandles(count, startClose = 1400) {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: `2026-04-28T${String(9 + Math.floor(index / 12)).padStart(2, "0")}:${String((index % 12) * 5).padStart(2, "0")}:00+05:30`,
    open: startClose + index,
    high: startClose + index + 2,
    low: startClose + index - 2,
    close: startClose + index + 1,
    volume: 100 + (index * 10),
  }));
}

describe("signalService", () => {
  it("fetches market data, computes indicators, and returns a signal payload", async () => {
    const kiteClient = {
      getLTP: jest.fn().mockResolvedValue({
        symbol: "NSE:INFY",
        instrumentToken: 408065,
        lastPrice: 1580,
      }),
    };
    const historicalClient = {
      getHistoricalCandles: jest.fn().mockResolvedValue(buildCandles(50)),
    };

    const service = createSignalService({
      kiteClient,
      historicalClient,
    });

    const result = await service.getSignal("NSE:INFY");
    logTestCase(
      "signalService: bullish signal generation",
      { symbol: "NSE:INFY", candleCount: 50 },
      result,
    );

    expect(result).toMatchObject({
      symbol: "NSE:INFY",
      ltp: 1580,
      signal_type: "INTRADAY_LONG",
      signal: "INTRADAY_LONG",
      trade_action: "BUY",
      entry_zone: {
        min: expect.any(Number),
        max: expect.any(Number),
      },
      stop_loss: expect.any(Number),
      targets: expect.any(Array),
      confidence_score: expect.any(Number),
      valid_until: expect.any(String),
      indicators: expect.objectContaining({
        priceTrend: "up",
        emaAlignment: "bullish",
        volume: "increasing",
        oiSignal: "neutral",
        derivatives: expect.objectContaining({
          status: "unavailable",
          oiConfirmation: "unavailable",
        }),
      }),
      reason: expect.any(String),
    });
    expect(result.indicators.rsi).toEqual(expect.any(Number));
    expect(result.indicators.rsi).toBeGreaterThan(55);

    expect(kiteClient.getLTP).toHaveBeenCalledWith("NSE:INFY");
    expect(historicalClient.getHistoricalCandles).toHaveBeenCalledWith(
      "NSE:INFY",
      "5minute",
      600,
      expect.objectContaining({
        instrumentToken: 408065,
        maxLookbackMinutes: 10080,
        marketContext: expect.objectContaining({
          mode: expect.any(String),
        }),
      }),
    );
  });

  it("merges derivatives confirmation into signal payload and confidence", async () => {
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          instrumentToken: 408065,
          lastPrice: 1580,
        }),
      },
      historicalClient: {
        getHistoricalCandlesByCount: jest.fn().mockResolvedValue(buildCandles(120)),
      },
      derivativesProvider: {
        getOptionChain: jest.fn().mockResolvedValue({
          underlying: "INFY",
          spotPrice: 1580,
          expiry: "2026-05-28",
          contracts: [
            { strike: 1560, optionType: "PE", oi: 2200, volume: 150, lastPrice: 18 },
            { strike: 1580, optionType: "PE", oi: 1800, volume: 120, lastPrice: 28 },
            { strike: 1600, optionType: "CE", oi: 900, volume: 100, lastPrice: 22 },
            { strike: 1620, optionType: "CE", oi: 800, volume: 90, lastPrice: 16 },
          ],
        }),
      },
    });

    const result = await service.getSignal("NSE:INFY");

    expect(result.signal_type).toBe("INTRADAY_LONG");
    expect(result.indicators.derivatives).toMatchObject({
      status: "available",
      derivativesBias: "bullish",
      oiConfirmation: "confirms",
      pcr: expect.any(Number),
      oiSupport: 1560,
      oiResistance: 1600,
    });
    expect(result.evidence).toEqual(
      expect.objectContaining({
        derivatives_status: "available",
        derivatives_bias: "bullish",
        oi_confirmation: "confirms",
      }),
    );
  });

  it("should return NO_TRADE when candles are fewer than the minimum required", async () => {
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          instrumentToken: 408065,
          lastPrice: 1520.4,
        }),
      },
      historicalClient: {
        getHistoricalCandles: jest
          .fn()
          .mockResolvedValue(buildCandles(MIN_REQUIRED_CANDLES - 1)),
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    const result = await service.getSignal("NSE:INFY");
    logTestCase(
      "signalService: insufficient data safe response",
      { symbol: "NSE:INFY", candleCount: MIN_REQUIRED_CANDLES - 1 },
      result,
    );

    expect(result).toMatchObject({
      symbol: "NSE:INFY",
      ltp: 1520.4,
      signal_type: "NO_TRADE",
      signal: "NO_TRADE",
      trade_action: "NONE",
      reason: "INSUFFICIENT_DATA",
      indicators: null,
      entry_zone: null,
      stop_loss: null,
      targets: [],
      confidence_score: 0,
      meta: {
        receivedCandles: MIN_REQUIRED_CANDLES - 1,
        requiredCandles: MIN_REQUIRED_CANDLES,
      },
    });
  });

  it("should not throw error when indicator computation fails", async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          lastPrice: 1520.4,
        }),
      },
      indicatorProvider: () => {
        throw new Error("EMA requires at least 50 close prices");
      },
      logger,
    });

    const result = await service.getSignal("NSE:INFY");
    logTestCase(
      "signalService: indicator failure safe response",
      { symbol: "NSE:INFY", indicatorProvider: "throws error" },
      result,
    );
    expect(result).toMatchObject({
      symbol: "NSE:INFY",
      ltp: 1520.4,
      signal_type: "NO_TRADE",
      signal: "NO_TRADE",
      trade_action: "NONE",
      reason: "INDICATOR_ERROR",
      indicators: null,
      entry_zone: null,
      stop_loss: null,
      targets: [],
      confidence_score: 0,
      meta: {
        receivedCandles: 0,
        requiredCandles: MIN_REQUIRED_CANDLES,
      },
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("uses target-candle fetch path in adaptive mode", async () => {
    const historicalClient = {
      getHistoricalCandlesByCount: jest.fn().mockResolvedValue(buildCandles(80)),
    };
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          instrumentToken: 408065,
          lastPrice: 1585,
        }),
      },
      historicalClient,
      candleSufficiencyMode: CANDLE_SUFFICIENCY_MODES.ADAPTIVE,
      targetCandleCount: 80,
    });

    const result = await service.getSignal("NSE:INFY");

    expect(result.signal_type).toMatch(/INTRADAY_LONG|INTRADAY_SHORT|NO_TRADE/);
    expect(result.meta).toEqual(
      expect.objectContaining({
        sufficiencyMode: CANDLE_SUFFICIENCY_MODES.ADAPTIVE,
        isDegraded: false,
      }),
    );
    expect(historicalClient.getHistoricalCandlesByCount).toHaveBeenCalledWith(
      "NSE:INFY",
      "5minute",
      80,
      expect.objectContaining({
        instrumentToken: 408065,
        maxLookbackMinutes: 10080,
        marketContext: expect.objectContaining({
          mode: expect.any(String),
        }),
      }),
    );
  });

  it("returns NO_TRADE when candles are below the configured minimum", async () => {
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          instrumentToken: 408065,
          lastPrice: 1540,
        }),
      },
      historicalClient: {
        getHistoricalCandlesByCount: jest.fn().mockResolvedValue(buildCandles(28)),
      },
      candleSufficiencyMode: CANDLE_SUFFICIENCY_MODES.DEGRADED,
    });

    const result = await service.getSignal("NSE:INFY");

    expect(result.signal_type).toBe("NO_TRADE");
    expect(result.indicators).toBeNull();
    expect(result.meta).toEqual(
      expect.objectContaining({
        receivedCandles: 28,
        requiredCandles: 50,
      }),
    );
  });

  it("marks signal as degraded when minimum candles exist but target warmup is short", async () => {
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          instrumentToken: 408065,
          lastPrice: 1585,
        }),
      },
      historicalClient: {
        getHistoricalCandlesByCount: jest.fn().mockResolvedValue(buildCandles(80)),
      },
      targetCandleCount: 120,
    });

    const result = await service.getSignal("NSE:INFY");

    expect(result.indicators).toEqual(expect.any(Object));
    expect(result.meta).toEqual(
      expect.objectContaining({
        isDegraded: true,
        degradedReason: "BELOW_TARGET_CANDLES",
        confidenceCap: 0.6,
      }),
    );
    expect(result.confidence_score).toBeLessThanOrEqual(60);
  });

  it("blocks live intraday signal generation outside allowed market modes when enforced", async () => {
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn(),
      },
      historicalClient: {
        getHistoricalCandlesByCount: jest.fn(),
      },
      marketClock: {
        getMarketContext: () => ({
          mode: "PRE_MARKET",
          is_trade_signal_allowed: false,
        }),
      },
      enforceMarketSignalMode: true,
    });

    const result = await service.getSignal("NSE:INFY");

    expect(result.signal_type).toBe("NO_TRADE");
    expect(result.reason).toBe("MARKET_MODE_BLOCKED");
    expect(result.meta.marketContext.mode).toBe("PRE_MARKET");
  });
});
