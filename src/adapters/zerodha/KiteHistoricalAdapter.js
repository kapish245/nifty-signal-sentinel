const { createHistoricalDataClient } = require("../../data/kiteHistorical");

class KiteHistoricalAdapter {
  #client;

  constructor({ client, apiKey, accessToken, logger, rateLimiter } = {}) {
    this.#client = client || createHistoricalDataClient({
      apiKey,
      accessToken,
      logger,
      rateLimiter,
    });
  }

  getHistoricalCandles(symbol, interval, lookbackMinutes, options) {
    return this.#client.getHistoricalCandles(symbol, interval, lookbackMinutes, options);
  }

  getHistoricalCandlesByCount(symbol, interval, targetCandles, options) {
    return this.#client.getHistoricalCandlesByCount(symbol, interval, targetCandles, options);
  }
}

module.exports = KiteHistoricalAdapter;
