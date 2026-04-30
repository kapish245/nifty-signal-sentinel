const KiteAuthAdapter = require("../adapters/zerodha/KiteAuthAdapter");

class AuthController {
  #auth_adapter;

  constructor({ authAdapter = new KiteAuthAdapter() } = {}) {
    this.#auth_adapter = authAdapter;
  }

  generateLoginUrl(apiKey) {
    return this.#auth_adapter.generateLoginUrl(apiKey);
  }

  extractRequestToken(callbackInput) {
    return this.#auth_adapter.extractRequestToken(callbackInput);
  }

  exchangeRequestToken(params) {
    return this.#auth_adapter.exchangeRequestToken(params);
  }
}

module.exports = AuthController;
