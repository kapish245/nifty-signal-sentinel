const { createKiteClient } = require("../../data/kiteClient");

class KiteQuoteAdapter {
  #client;

  constructor({ client, apiKey, accessToken, logger, rateLimiter } = {}) {
    this.#client = client || createKiteClient({
      apiKey,
      accessToken,
      logger,
      rateLimiter,
    });
  }

  getLTP(symbol) {
    return this.#client.getLTP(symbol);
  }
}

module.exports = KiteQuoteAdapter;
