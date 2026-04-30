const { calculateATR } = require("../src/engines/technical/indicators/AtrIndicator");
const { calculateMACD } = require("../src/engines/technical/indicators/MacdIndicator");
const { calculateVWAP } = require("../src/engines/technical/indicators/VwapIndicator");
const MultiTimeframeAnalyzer = require("../src/engines/technical/MultiTimeframeAnalyzer");
const { detectBreakout } = require("../src/engines/technical/price_action/BreakoutDetector");
const {
  detectSupportResistance,
} = require("../src/engines/technical/price_action/SupportResistanceDetector");
const { RiskManager } = require("../src/engines/technical/RiskManager");

function buildCandles(count, startClose = 100) {
  return Array.from({ length: count }, (_, index) => {
    const close = startClose + index;

    return {
      timestamp: `2026-04-30T09:${String(index % 60).padStart(2, "0")}:00+05:30`,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + index * 10,
    };
  });
}

describe("phase 4 technical engine", () => {
  it("calculates VWAP, ATR and MACD", () => {
    const candles = buildCandles(60);
    const closePrices = candles.map((candle) => candle.close);

    expect(calculateVWAP(candles)).toEqual(expect.any(Number));
    expect(calculateATR(candles)).toBeGreaterThan(0);
    expect(calculateMACD(closePrices)).toEqual(
      expect.objectContaining({
        macd: expect.any(Number),
        signal: expect.any(Number),
        histogram: expect.any(Number),
        bias: expect.stringMatching(/bullish|bearish|neutral/),
      }),
    );
  });

  it("detects support, resistance and confirmed breakouts", () => {
    const candles = buildCandles(50);
    const levels = detectSupportResistance(candles);
    const breakout = detectBreakout({
      price: levels.resistance * 1.01,
      support: levels.support,
      resistance: levels.resistance,
      volumeTrend: "increasing",
    });

    expect(levels).toEqual({
      support: expect.any(Number),
      resistance: expect.any(Number),
    });
    expect(breakout).toEqual({
      type: "bullish_breakout",
      isConfirmed: true,
    });
  });

  it("builds multi-timeframe context", () => {
    const analyzer = new MultiTimeframeAnalyzer();
    const frames = {
      minute: buildCandles(80),
      "5minute": buildCandles(80),
      "15minute": buildCandles(80),
    };

    const result = analyzer.analyze({ frames, ltp: 190 });

    expect(result).toEqual(
      expect.objectContaining({
        vwap: expect.any(Number),
        atr: expect.any(Number),
        macd: expect.any(Object),
        support: expect.any(Number),
        resistance: expect.any(Number),
        breakout: expect.any(Object),
        timeframes: expect.objectContaining({
          minute: expect.any(Object),
          "5minute": expect.any(Object),
          "15minute": expect.any(Object),
        }),
        multiTimeframeBias: expect.stringMatching(/bullish|bearish|neutral/),
      }),
    );
  });

  it("uses ATR stop when support is too far from long entry", () => {
    const riskManager = new RiskManager();
    const risk = riskManager.buildLongRisk({
      ltp: 1580,
      indicators: {
        atr: 4,
        support: 1408,
        resistance: 1600,
      },
    });

    expect(risk.stop_loss).toBe(1576);
  });
});
