class HistoricalBacktestCandleProvider {
  #historical_client;

  #cache;

  #interval;

  #lookback_minutes;

  constructor({ historicalClient, interval = "minute", lookbackMinutes = 2 * 24 * 60 } = {}) {
    if (!historicalClient || typeof historicalClient.getHistoricalCandles !== "function") {
      throw new Error("historicalClient with getHistoricalCandles(symbol, interval, lookbackMinutes) is required");
    }

    this.#historical_client = historicalClient;
    this.#cache = new Map();
    this.#interval = interval;
    this.#lookback_minutes = lookbackMinutes;
  }

  async getCandlesForSignal(signal) {
    const symbol = signal?.symbol;
    if (!symbol) throw new Error("Signal symbol is required");

    if (!this.#cache.has(symbol)) {
      const candles = await this.#historical_client.getHistoricalCandles(
        symbol,
        this.#interval,
        this.#lookback_minutes,
      );
      this.#cache.set(symbol, candles);
    }

    return this.#cache.get(symbol);
  }
}

module.exports = {
  HistoricalBacktestCandleProvider,
};
