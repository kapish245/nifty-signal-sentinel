class AtrIndicator {
  calculate(candles, period = 14) {
    if (!Array.isArray(candles) || candles.length < period + 1) {
      throw new Error("ATR requires candles greater than the period");
    }

    const true_ranges = [];

    for (let index = 1; index < candles.length; index += 1) {
      const candle = candles[index];
      const previous_close = candles[index - 1].close;
      const high_low = candle.high - candle.low;
      const high_close = Math.abs(candle.high - previous_close);
      const low_close = Math.abs(candle.low - previous_close);

      true_ranges.push(Math.max(high_low, high_close, low_close));
    }

    const recent_ranges = true_ranges.slice(-period);
    const atr = recent_ranges.reduce((sum, value) => sum + value, 0) / period;

    return Number(atr.toFixed(4));
  }
}

function calculateATR(candles, period) {
  return new AtrIndicator().calculate(candles, period);
}

module.exports = {
  AtrIndicator,
  calculateATR,
};
