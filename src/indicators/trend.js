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

  if (
    normalizedEma20 > normalizedEma50 &&
    normalizedPrice > normalizedEma20
  ) {
    return {
      priceTrend: "up",
      emaAlignment: "bullish",
    };
  }

  if (
    normalizedEma20 < normalizedEma50 &&
    normalizedPrice < normalizedEma20
  ) {
    return {
      priceTrend: "down",
      emaAlignment: "bearish",
    };
  }

  return {
    priceTrend: "sideways",
    emaAlignment: "neutral",
  };
}

module.exports = {
  detectTrend,
};
