const { MarketClock, MARKET_MODES } = require("../src/market/MarketClock");

describe("MarketClock", () => {
  it.each([
    ["2026-04-30T03:20:00.000Z", MARKET_MODES.PRE_MARKET],
    ["2026-04-30T03:50:00.000Z", MARKET_MODES.OPENING_MARKET],
    ["2026-04-30T05:00:00.000Z", MARKET_MODES.ACTIVE_MARKET],
    ["2026-04-30T09:45:00.000Z", MARKET_MODES.LATE_MARKET],
    ["2026-04-30T10:10:00.000Z", MARKET_MODES.POST_MARKET],
    ["2026-05-02T05:00:00.000Z", MARKET_MODES.WEEKEND_OR_HOLIDAY],
  ])("classifies %s as %s", (timestamp, expectedMode) => {
    const clock = new MarketClock({
      now_provider: () => new Date(timestamp),
    });

    const context = clock.getMarketContext();

    expect(context.mode).toBe(expectedMode);
  });
});
