const { MARKET_MODES } = require("./MarketClock");

const CANDLE_REQUIREMENTS = {
  minute: {
    interval: "minute",
    label: "1minute",
    targetCandles: 120,
    minimumCandles: 50,
    maxLookbackMinutes: 2 * 24 * 60,
  },
  "5minute": {
    interval: "5minute",
    label: "5minute",
    targetCandles: 120,
    minimumCandles: 50,
    maxLookbackMinutes: 7 * 24 * 60,
  },
  "15minute": {
    interval: "15minute",
    label: "15minute",
    targetCandles: 80,
    minimumCandles: 30,
    maxLookbackMinutes: 14 * 24 * 60,
  },
  day: {
    interval: "day",
    label: "day",
    targetCandles: 60,
    minimumCandles: 20,
    maxLookbackMinutes: 140 * 24 * 60,
  },
};

function normalizeInterval(interval) {
  if (interval === "1minute") {
    return "minute";
  }

  return interval;
}

class CandleRequirementService {
  getRequirement(interval, market_mode = MARKET_MODES.ACTIVE_MARKET) {
    const normalized_interval = normalizeInterval(interval);
    const requirement = CANDLE_REQUIREMENTS[normalized_interval];

    if (!requirement) {
      throw new Error("Unsupported candle interval");
    }

    return {
      ...requirement,
      interval: normalized_interval,
      market_mode,
      should_generate_intraday_signal: [
        MARKET_MODES.OPENING_MARKET,
        MARKET_MODES.ACTIVE_MARKET,
        MARKET_MODES.LATE_MARKET,
      ].includes(market_mode),
    };
  }
}

module.exports = {
  CANDLE_REQUIREMENTS,
  CandleRequirementService,
  normalizeInterval,
};
