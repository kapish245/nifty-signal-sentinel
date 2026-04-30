const {
  CandleRequirementService,
  normalizeInterval,
} = require("../src/market/CandleRequirementService");

describe("CandleRequirementService", () => {
  it("returns intraday candle policy for each required interval", () => {
    const service = new CandleRequirementService();

    expect(service.getRequirement("1minute")).toMatchObject({
      interval: "minute",
      targetCandles: 120,
      minimumCandles: 50,
    });
    expect(service.getRequirement("5minute")).toMatchObject({
      interval: "5minute",
      targetCandles: 120,
      minimumCandles: 50,
    });
    expect(service.getRequirement("15minute")).toMatchObject({
      interval: "15minute",
      targetCandles: 80,
      minimumCandles: 30,
    });
    expect(service.getRequirement("day")).toMatchObject({
      interval: "day",
      targetCandles: 60,
      minimumCandles: 20,
    });
  });

  it("normalizes user-facing 1minute interval to Zerodha minute interval", () => {
    expect(normalizeInterval("1minute")).toBe("minute");
    expect(normalizeInterval("5minute")).toBe("5minute");
  });
});
