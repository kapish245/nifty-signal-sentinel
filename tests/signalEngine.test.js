const { evaluateSignal } = require("../src/signals/signalEngine");

describe("signalEngine", () => {
  it("returns HOLD for a strong bullish continuation", () => {
    const result = evaluateSignal({
      priceTrend: "up",
      emaAlignment: "bullish",
      rsi: 61,
      volume: "increasing",
      oiSignal: "long_buildup",
    });

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

    expect(result).toBe("SELL");
  });
});
