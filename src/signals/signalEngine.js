const SIGNALS = {
  HOLD: "HOLD",
  SELL: "SELL",
  NO_TRADE: "NO_TRADE",
};

function validateSignalInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Signal input must be an object");
  }

  if (typeof input.rsi !== "number" || Number.isNaN(input.rsi)) {
    throw new Error("RSI must be a valid number");
  }

  return input;
}

function isBullishContinuation(input) {
  return (
    input.priceTrend === "up" &&
    input.emaAlignment === "bullish" &&
    input.rsi > 55 &&
    input.volume === "increasing" &&
    (input.oiSignal === "long_buildup" ||
      input.oiSignal === "short_covering")
  );
}

function isBearishBreakdown(input) {
  return (
    input.priceTrend === "down" &&
    input.emaAlignment === "bearish" &&
    input.rsi < 40 &&
    input.volume === "increasing" &&
    input.oiSignal === "short_buildup"
  );
}

function evaluateSignal(input) {
  const normalizedInput = validateSignalInput(input);

  if (isBullishContinuation(normalizedInput)) {
    return SIGNALS.HOLD;
  }

  if (isBearishBreakdown(normalizedInput)) {
    return SIGNALS.SELL;
  }

  return SIGNALS.NO_TRADE;
}

module.exports = {
  SIGNALS,
  evaluateSignal,
  isBullishContinuation,
  isBearishBreakdown,
};
