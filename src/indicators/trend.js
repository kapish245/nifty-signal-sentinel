const { createLogger } = require("../logger/logger");

const indicatorLogger = createLogger({ moduleName: "indicators:trend" });

function requireNumber(value, fieldName) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return value;
}

function detectTrend({ price, ema20, ema50 } = {}) {
  const normalizedPrice = requireNumber(price, "Price");
  const normalizedEma20 = requireNumber(ema20, "EMA20");
  const normalizedEma50 = requireNumber(ema50, "EMA50");
  indicatorLogger.debug(
    {
      price: normalizedPrice,
      ema20: normalizedEma20,
      ema50: normalizedEma50,
    },
    "Trend detection input",
  );

  if (
    normalizedEma20 > normalizedEma50 &&
    normalizedPrice > normalizedEma20
  ) {
    const bullishTrend = {
      priceTrend: "up",
      emaAlignment: "bullish",
    };
    indicatorLogger.debug(bullishTrend, "Trend detection output");
    return bullishTrend;
  }

  if (
    normalizedEma20 < normalizedEma50 &&
    normalizedPrice < normalizedEma20
  ) {
    const bearishTrend = {
      priceTrend: "down",
      emaAlignment: "bearish",
    };
    indicatorLogger.debug(bearishTrend, "Trend detection output");
    return bearishTrend;
  }

  const neutralTrend = {
    priceTrend: "sideways",
    emaAlignment: "neutral",
  };
  indicatorLogger.debug(neutralTrend, "Trend detection output");
  return neutralTrend;
}

module.exports = {
  detectTrend,
};
