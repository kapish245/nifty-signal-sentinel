class BreakoutDetector {
  detect({ price, support, resistance, volumeTrend, bufferPercent = 0.001 } = {}) {
    if (typeof price !== "number" || typeof support !== "number" || typeof resistance !== "number") {
      throw new Error("Breakout detection requires price, support, and resistance");
    }

    const upper_buffer = resistance * (1 + bufferPercent);
    const lower_buffer = support * (1 - bufferPercent);

    if (price > upper_buffer) {
      return {
        type: "bullish_breakout",
        isConfirmed: volumeTrend === "increasing",
      };
    }

    if (price < lower_buffer) {
      return {
        type: "bearish_breakdown",
        isConfirmed: volumeTrend === "increasing",
      };
    }

    return {
      type: "none",
      isConfirmed: false,
    };
  }
}

function detectBreakout(payload) {
  return new BreakoutDetector().detect(payload);
}

module.exports = {
  BreakoutDetector,
  detectBreakout,
};
