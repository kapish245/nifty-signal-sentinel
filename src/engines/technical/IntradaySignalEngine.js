const { SIGNAL_TYPES } = require("./SignalTypes");

const SIGNALS = {
  INTRADAY_LONG: SIGNAL_TYPES.INTRADAY_LONG,
  INTRADAY_SHORT: SIGNAL_TYPES.INTRADAY_SHORT,
  WAIT_FOR_BREAKOUT: SIGNAL_TYPES.WAIT_FOR_BREAKOUT,
  WAIT_FOR_PULLBACK: SIGNAL_TYPES.WAIT_FOR_PULLBACK,
  NO_TRADE: SIGNAL_TYPES.NO_TRADE,
  AVOID: SIGNAL_TYPES.AVOID,
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
    input.multiTimeframeBias !== "bearish" &&
    hasBullishTrigger(input)
  );
}

function isBearishBreakdown(input) {
  return (
    input.priceTrend === "down" &&
    input.emaAlignment === "bearish" &&
    input.rsi < 40 &&
    input.volume === "increasing" &&
    input.multiTimeframeBias !== "bullish" &&
    hasBearishTrigger(input)
  );
}

function hasBullishTrigger(input) {
  return input.oiSignal === "long_buildup" ||
    input.oiSignal === "short_covering" ||
    input.breakout?.type === "bullish_breakout" ||
    input.macd?.bias === "bullish" ||
    input.vwap < input.ltp;
}

function hasBearishTrigger(input) {
  return input.oiSignal === "short_buildup" ||
    input.breakout?.type === "bearish_breakdown" ||
    input.macd?.bias === "bearish" ||
    input.vwap > input.ltp;
}

class IntradaySignalEngine {
  evaluate(input) {
    const normalizedInput = validateSignalInput(input);

    if (isBullishContinuation(normalizedInput)) {
      return SIGNALS.INTRADAY_LONG;
    }

    if (isBearishBreakdown(normalizedInput)) {
      return SIGNALS.INTRADAY_SHORT;
    }

    return SIGNALS.NO_TRADE;
  }
}

function evaluateSignal(input) {
  return new IntradaySignalEngine().evaluate(input);
}

module.exports = {
  SIGNALS,
  IntradaySignalEngine,
  evaluateSignal,
  hasBullishTrigger,
  hasBearishTrigger,
  isBullishContinuation,
  isBearishBreakdown,
  validateSignalInput,
};
