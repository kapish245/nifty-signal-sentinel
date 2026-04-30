class VwapIndicator {
  calculate(candles) {
    if (!Array.isArray(candles) || candles.length === 0) {
      throw new Error("VWAP requires at least one candle");
    }

    let cumulative_price_volume = 0;
    let cumulative_volume = 0;

    for (const candle of candles) {
      const typical_price = (candle.high + candle.low + candle.close) / 3;
      cumulative_price_volume += typical_price * candle.volume;
      cumulative_volume += candle.volume;
    }

    if (cumulative_volume <= 0) {
      throw new Error("VWAP requires positive candle volume");
    }

    return Number((cumulative_price_volume / cumulative_volume).toFixed(4));
  }
}

function calculateVWAP(candles) {
  return new VwapIndicator().calculate(candles);
}

module.exports = {
  VwapIndicator,
  calculateVWAP,
};
