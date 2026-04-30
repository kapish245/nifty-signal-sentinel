const JsonFileRepository = require("./JsonFileRepository");

class MarketContextRepository {
  #json_repository;

  constructor({ root_dir, json_repository } = {}) {
    this.#json_repository = json_repository || new JsonFileRepository({ root_dir });
  }

  async saveMarketContext({ date, context }) {
    return this.#json_repository.writeJson(`market_context/${date}.json`, {
      date,
      context,
      updated_at: new Date().toISOString(),
    });
  }

  async loadMarketContext(date) {
    return this.#json_repository.readJson(`market_context/${date}.json`, null);
  }
}

module.exports = MarketContextRepository;
