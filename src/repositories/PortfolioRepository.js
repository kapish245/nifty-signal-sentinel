const fs = require("fs/promises");
const path = require("path");

const DEFAULT_PORTFOLIO = {
  capital: null,
  holdings: [],
  watchlist: [],
};

class PortfolioRepository {
  #file_path;

  constructor({ filePath = path.resolve(process.cwd(), "data", "portfolio.json") } = {}) {
    this.#file_path = filePath;
  }

  async loadPortfolio() {
    try {
      const contents = await fs.readFile(this.#file_path, "utf8");
      return this.#normalizePortfolio(JSON.parse(contents));
    } catch (error) {
      if (error.code === "ENOENT") return { ...DEFAULT_PORTFOLIO };
      throw error;
    }
  }

  #normalizePortfolio(portfolio) {
    if (!portfolio || typeof portfolio !== "object" || Array.isArray(portfolio)) {
      throw new Error("Portfolio JSON must be an object");
    }

    return {
      capital: this.#toNumberOrNull(portfolio.capital),
      holdings: Array.isArray(portfolio.holdings) ? portfolio.holdings : [],
      watchlist: Array.isArray(portfolio.watchlist) ? portfolio.watchlist : [],
    };
  }

  #toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;

    const numeric_value = Number(value);
    return Number.isFinite(numeric_value) ? numeric_value : null;
  }
}

module.exports = {
  DEFAULT_PORTFOLIO,
  PortfolioRepository,
};
