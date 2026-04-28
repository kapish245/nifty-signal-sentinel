const { evaluateSignal } = require("../src/signals/signalEngine");
const { logTestCase } = require("./utils/testCaseLogger");

describe("signalEngine", () => {
  it("returns HOLD for a strong bullish continuation", () => {
    const result = evaluateSignal({
      priceTrend: "up",
      emaAlignment: "bullish",
      rsi: 61,
      volume: "increasing",
      oiSignal: "long_buildup",
    });
    logTestCase("signalEngine: HOLD condition", { priceTrend: "up", emaAlignment: "bullish", rsi: 61 }, { result });

    expect(result).toBe("HOLD");
  });

  it("returns NO_TRADE for weak or sideways market structure", () => {
    const result = evaluateSignal({
      priceTrend: "sideways",
      emaAlignment: "neutral",
      rsi: 49,
      volume: "flat",
      oiSignal: "neutral",
    });
    logTestCase("signalEngine: NO_TRADE condition", { priceTrend: "sideways", emaAlignment: "neutral", rsi: 49 }, { result });

    expect(result).toBe("NO_TRADE");
  });

  it("returns SELL for a bearish breakdown", () => {
    const result = evaluateSignal({
      priceTrend: "down",
      emaAlignment: "bearish",
      rsi: 34,
      volume: "increasing",
      oiSignal: "short_buildup",
    });
    logTestCase("signalEngine: SELL condition", { priceTrend: "down", emaAlignment: "bearish", rsi: 34 }, { result });

    expect(result).toBe("SELL");
  });
});
