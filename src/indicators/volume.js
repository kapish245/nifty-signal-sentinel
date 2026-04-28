function detectVolumeTrend(candles) {
  if (!Array.isArray(candles) || candles.length < 6) {
    throw new Error("Volume trend requires at least 6 candles");
  }

  const normalizedVolumes = candles.map((candle) => {
    if (typeof candle?.volume !== "number" || Number.isNaN(candle.volume)) {
      throw new Error("Volume trend requires candles with numeric volume");
    }

    return candle.volume;
  });

  const previousThree = normalizedVolumes
    .slice(-6, -3)
    .reduce((sum, volume) => sum + volume, 0);
  const latestThree = normalizedVolumes
    .slice(-3)
    .reduce((sum, volume) => sum + volume, 0);

  if (latestThree > previousThree) {
    return "increasing";
  }

  if (latestThree < previousThree) {
    return "decreasing";
  }

  return "neutral";
}

module.exports = {
  detectVolumeTrend,
};
