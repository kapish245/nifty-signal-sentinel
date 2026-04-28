const { calculateRSI } = require("../src/indicators/rsi");
const { calculateEMA, calculateEmaPair } = require("../src/indicators/ema");
const { detectVolumeTrend } = require("../src/indicators/volume");

describe("indicator calculations", () => {
  it("calculates RSI(14) using Wilder smoothing", () => {
    const closePrices = [
      44.34,
      44.09,
      44.15,
      43.61,
      44.33,
      44.83,
      45.1,
      45.42,
      45.84,
      46.08,
      45.89,
      46.03,
      45.61,
      46.28,
      46.28,
    ];

    expect(calculateRSI(closePrices)).toBeCloseTo(70.46, 2);
  });

  it("calculates EMA for a supplied period", () => {
    expect(calculateEMA([1, 2, 3, 4, 5], 3)).toBeCloseTo(4, 10);
  });

  it("returns EMA20 and EMA50 for close prices", () => {
    const closePrices = Array.from({ length: 60 }, (_, index) => index + 1);

    expect(calculateEmaPair(closePrices)).toEqual({
      ema20: expect.any(Number),
      ema50: expect.any(Number),
    });
    expect(calculateEmaPair(closePrices).ema20).toBeGreaterThan(
      calculateEmaPair(closePrices).ema50,
    );
  });

  it("classifies volume trend from the latest six candles", () => {
    const candles = [
      { volume: 100 },
      { volume: 110 },
      { volume: 120 },
      { volume: 150 },
      { volume: 160 },
      { volume: 170 },
    ];

    expect(detectVolumeTrend(candles)).toBe("increasing");
  });
});
