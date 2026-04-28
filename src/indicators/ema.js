function validateClosePrices(closePrices, minimumLength, indicatorName) {
  if (!Array.isArray(closePrices)) {
    throw new Error(`${indicatorName} requires an array of close prices`);
  }

  if (closePrices.length < minimumLength) {
    throw new Error(
      `${indicatorName} requires at least ${minimumLength} close prices`,
    );
  }

  for (const price of closePrices) {
    if (typeof price !== "number" || Number.isNaN(price)) {
      throw new Error(`${indicatorName} requires valid numeric close prices`);
    }
  }
}

function calculateEMA(closePrices, period) {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("EMA period must be a positive integer");
  }

  validateClosePrices(closePrices, period, "EMA");

  const multiplier = 2 / (period + 1);
  let ema =
    closePrices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

  for (let index = period; index < closePrices.length; index += 1) {
    ema = ((closePrices[index] - ema) * multiplier) + ema;
  }

  return ema;
}

function calculateEmaPair(closePrices) {
  return {
    ema20: calculateEMA(closePrices, 20),
    ema50: calculateEMA(closePrices, 50),
  };
}

module.exports = {
  calculateEMA,
  calculateEmaPair,
};
