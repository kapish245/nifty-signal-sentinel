const { createLogger } = require("../logger/logger");

const indicatorLogger = createLogger({ moduleName: "indicators:rsi" });

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

function calculateRSI(closePrices, period = 14) {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("RSI period must be a positive integer");
  }

  validateClosePrices(closePrices, period + 1, "RSI");
  indicatorLogger.debug(
    { period, candleCount: closePrices.length },
    "RSI calculation started",
  );

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = closePrices[index] - closePrices[index - 1];

    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let index = period + 1; index < closePrices.length; index += 1) {
    const change = closePrices[index] - closePrices[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    averageGain = ((averageGain * (period - 1)) + gain) / period;
    averageLoss = ((averageLoss * (period - 1)) + loss) / period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  const rsi = 100 - (100 / (1 + relativeStrength));
  indicatorLogger.debug(
    {
      period,
      candleCount: closePrices.length,
      averageGain: Number(averageGain.toFixed(6)),
      averageLoss: Number(averageLoss.toFixed(6)),
      rsi: Number(rsi.toFixed(4)),
    },
    "RSI calculation completed",
  );
  return rsi;
}

module.exports = {
  calculateRSI,
};
