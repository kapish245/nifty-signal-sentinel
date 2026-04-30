const { createKiteDerivativesClient } = require("../../data/kiteDerivatives");

class KiteDerivativesAdapter {
  #client;

  constructor({ client, apiKey, accessToken, logger, rateLimiter } = {}) {
    this.#client = client || createKiteDerivativesClient({
      apiKey,
      accessToken,
      logger,
      rateLimiter,
    });
  }

  getOptionChain(params) {
    return this.#client.getOptionChain(params);
  }
}

module.exports = KiteDerivativesAdapter;
