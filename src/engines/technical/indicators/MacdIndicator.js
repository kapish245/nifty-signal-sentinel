const { calculateEMA } = require("../../../indicators/ema");

class MacdIndicator {
  calculate(close_prices, fast_period = 12, slow_period = 26, signal_period = 9) {
    const minimum_count = slow_period + signal_period;

    if (!Array.isArray(close_prices) || close_prices.length < minimum_count) {
      throw new Error("MACD requires enough close prices for slow and signal periods");
    }

    const macd_series = this.#buildMacdSeries(close_prices, fast_period, slow_period);
    const signal = calculateEMA(macd_series, signal_period);
    const macd = macd_series[macd_series.length - 1];
    const histogram = macd - signal;

    return {
      macd: Number(macd.toFixed(4)),
      signal: Number(signal.toFixed(4)),
      histogram: Number(histogram.toFixed(4)),
      bias: this.#getBias({ macd, signal, histogram }),
    };
  }

  #buildMacdSeries(close_prices, fast_period, slow_period) {
    const series = [];

    for (let index = slow_period; index <= close_prices.length; index += 1) {
      const slice = close_prices.slice(0, index);
      series.push(calculateEMA(slice, fast_period) - calculateEMA(slice, slow_period));
    }

    return series;
  }

  #getBias({ macd, signal, histogram }) {
    if (macd > signal && histogram > 0) return "bullish";
    if (macd < signal && histogram < 0) return "bearish";
    return "neutral";
  }
}

function calculateMACD(close_prices, fast_period, slow_period, signal_period) {
  return new MacdIndicator().calculate(close_prices, fast_period, slow_period, signal_period);
}

module.exports = {
  MacdIndicator,
  calculateMACD,
};
