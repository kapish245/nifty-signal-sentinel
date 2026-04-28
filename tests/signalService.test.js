const {
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
      indicators: expect.objectContaining({
        priceTrend: "up",
        emaAlignment: "bullish",
        volume: "increasing",
        oiSignal: "long_buildup",
      }),
      signal: "HOLD",
      reason: expect.any(String),
    });
    expect(result.indicators.rsi).toEqual(expect.any(Number));
    expect(result.indicators.rsi).toBeGreaterThan(55);

    expect(kiteClient.getLTP).toHaveBeenCalledWith("NSE:INFY");
    expect(historicalClient.getHistoricalCandles).toHaveBeenCalledWith(
      "NSE:INFY",
      "5minute",
      600,
      { instrumentToken: 408065 },
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

    expect(result).toEqual({
      symbol: "NSE:INFY",
      ltp: 1520.4,
      signal: "NO_TRADE",
      reason: "INSUFFICIENT_DATA",
      indicators: null,
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
    expect(result).toEqual({
      symbol: "NSE:INFY",
      ltp: 1520.4,
      signal: "NO_TRADE",
      reason: "INDICATOR_ERROR",
      indicators: null,
      meta: {
        receivedCandles: 0,
        requiredCandles: MIN_REQUIRED_CANDLES,
      },
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
