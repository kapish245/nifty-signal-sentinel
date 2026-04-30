class SupportResistanceDetector {
  detect(candles, lookback = 40) {
    if (!Array.isArray(candles) || candles.length === 0) {
      throw new Error("Support/resistance detection requires candles");
    }

    const recent_candles = candles.slice(-lookback);
    const support = Math.min(...recent_candles.map((candle) => candle.low));
    const resistance = Math.max(...recent_candles.map((candle) => candle.high));

    return {
      support: Number(support.toFixed(2)),
      resistance: Number(resistance.toFixed(2)),
    };
  }
}

function detectSupportResistance(candles, lookback) {
  return new SupportResistanceDetector().detect(candles, lookback);
}

module.exports = {
  SupportResistanceDetector,
  detectSupportResistance,
};
