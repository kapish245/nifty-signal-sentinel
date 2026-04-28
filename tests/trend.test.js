const { detectTrend } = require("../src/indicators/trend");

describe("trend detection", () => {
  it("returns bullish trend when price is above EMA20 and EMA20 is above EMA50", () => {
    expect(
      detectTrend({
        price: 120,
        ema20: 110,
        ema50: 100,
      }),
    ).toEqual({
      priceTrend: "up",
      emaAlignment: "bullish",
    });
  });

  it("returns bearish trend when price is below EMA20 and EMA20 is below EMA50", () => {
    expect(
      detectTrend({
        price: 90,
        ema20: 100,
        ema50: 110,
      }),
    ).toEqual({
      priceTrend: "down",
      emaAlignment: "bearish",
    });
  });

  it("returns sideways when EMA alignment and price do not confirm a trend", () => {
    expect(
      detectTrend({
        price: 100,
        ema20: 100,
        ema50: 99,
      }),
    ).toEqual({
      priceTrend: "sideways",
      emaAlignment: "neutral",
    });
  });
});
