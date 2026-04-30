const { generateLoginUrl, extractRequestToken } = require("../../auth/login");
const {
  exchangeRequestToken,
  loadPersistedToken,
  persistAccessToken,
} = require("../../auth/token");

class KiteAuthAdapter {
  generateLoginUrl(apiKey) {
    return generateLoginUrl(apiKey);
  }

  extractRequestToken(callbackInput) {
    return extractRequestToken(callbackInput);
  }

  exchangeRequestToken(params) {
    return exchangeRequestToken(params);
  }

  loadPersistedToken(params) {
    return loadPersistedToken(params);
  }

  persistAccessToken(params) {
    return persistAccessToken(params);
  }
}

module.exports = KiteAuthAdapter;
