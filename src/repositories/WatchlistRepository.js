const JsonFileRepository = require("./JsonFileRepository");

class WatchlistRepository {
  #json_repository;

  constructor({ root_dir, json_repository } = {}) {
    this.#json_repository = json_repository || new JsonFileRepository({ root_dir });
  }

  async saveWatchlist({ date, candidates }) {
    return this.#json_repository.writeJson(`watchlists/${date}.json`, {
      date,
      generated_at: new Date().toISOString(),
      candidates,
    });
  }

  async loadWatchlist(date) {
    return this.#json_repository.readJson(`watchlists/${date}.json`, null);
  }
}

module.exports = WatchlistRepository;
