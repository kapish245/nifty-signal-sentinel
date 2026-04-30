const JsonFileRepository = require("./JsonFileRepository");
const { normalizeInterval } = require("../market/CandleRequirementService");

function normalizeSymbol(symbol) {
  return String(symbol || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

class CandleRepository {
  #json_repository;

  constructor({ root_dir, json_repository } = {}) {
    this.#json_repository = json_repository || new JsonFileRepository({ root_dir });
  }

  async saveCandles({ symbol, interval, date, candles }) {
    const normalized_interval = normalizeInterval(interval);
    const relative_path = this.#buildRelativePath({ symbol, interval: normalized_interval, date });
    const payload = {
      symbol,
      interval: normalized_interval,
      date,
      candles,
      updated_at: new Date().toISOString(),
    };

    return this.#json_repository.writeJson(relative_path, payload);
  }

  async loadCandles({ symbol, interval, date }) {
    const normalized_interval = normalizeInterval(interval);
    const relative_path = this.#buildRelativePath({ symbol, interval: normalized_interval, date });

    return this.#json_repository.readJson(relative_path, null);
  }

  #buildRelativePath({ symbol, interval, date }) {
    const symbol_part = normalizeSymbol(symbol);
    const file_name = interval === "day" ? "history.json" : `${date}.json`;

    return `candles/${symbol_part}/${interval}/${file_name}`;
  }
}

module.exports = {
  CandleRepository,
  normalizeSymbol,
};
