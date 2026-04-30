const MARKET_MODES = {
  PRE_MARKET: "PRE_MARKET",
  OPENING_MARKET: "OPENING_MARKET",
  ACTIVE_MARKET: "ACTIVE_MARKET",
  LATE_MARKET: "LATE_MARKET",
  POST_MARKET: "POST_MARKET",
  WEEKEND_OR_HOLIDAY: "WEEKEND_OR_HOLIDAY",
};

const MARKET_TIME_ZONE = "Asia/Kolkata";

function getIstParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value,
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
  };
}

function getMinutesSinceMidnight({ hour, minute }) {
  return hour * 60 + minute;
}

class MarketClock {
  #now_provider;

  constructor({ now_provider = () => new Date() } = {}) {
    this.#now_provider = now_provider;
  }

  getMarketContext(date = this.#now_provider()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error("MarketClock requires a valid Date");
    }

    const parts = getIstParts(date);
    const minutes = getMinutesSinceMidnight(parts);
    const mode = this.#getMode({ weekday: parts.weekday, minutes });

    return {
      mode,
      time_zone: MARKET_TIME_ZONE,
      is_market_open: [
        MARKET_MODES.OPENING_MARKET,
        MARKET_MODES.ACTIVE_MARKET,
        MARKET_MODES.LATE_MARKET,
      ].includes(mode),
      is_trade_signal_allowed: [
        MARKET_MODES.OPENING_MARKET,
        MARKET_MODES.ACTIVE_MARKET,
        MARKET_MODES.LATE_MARKET,
      ].includes(mode),
      minutes_since_midnight: minutes,
      observed_at: date.toISOString(),
    };
  }

  #getMode({ weekday, minutes }) {
    if (["Sat", "Sun"].includes(weekday)) {
      return MARKET_MODES.WEEKEND_OR_HOLIDAY;
    }

    if (minutes < 9 * 60 + 15) return MARKET_MODES.PRE_MARKET;
    if (minutes < 9 * 60 + 45) return MARKET_MODES.OPENING_MARKET;
    if (minutes < 15 * 60) return MARKET_MODES.ACTIVE_MARKET;
    if (minutes <= 15 * 60 + 30) return MARKET_MODES.LATE_MARKET;
    return MARKET_MODES.POST_MARKET;
  }
}

module.exports = {
  MARKET_MODES,
  MARKET_TIME_ZONE,
  MarketClock,
  getIstParts,
};
