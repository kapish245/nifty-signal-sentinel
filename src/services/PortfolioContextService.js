const { nifty50 } = require("../config/nifty50");
const { PortfolioRepository } = require("../repositories/PortfolioRepository");

const POSITION_CONTEXT_SOURCE = {
  LOCAL_JSON: "local_json",
  NONE: "none",
};

function normalizeSymbol(symbol) {
  return String(symbol || "")
    .replace(/^NSE:/i, "")
    .trim()
    .toUpperCase();
}

function roundNumber(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

class PortfolioContextService {
  #portfolio_repository;

  #logger;

  constructor({ portfolioRepository = new PortfolioRepository(), logger } = {}) {
    this.#portfolio_repository = portfolioRepository;
    this.#logger = logger;
  }

  async prepareScan({ baseSymbols = nifty50 } = {}) {
    const portfolio = await this.#portfolio_repository.loadPortfolio();
    const positions_by_symbol = this.#buildPositionMap(portfolio.holdings);
    const symbols = this.#mergeSymbols({ baseSymbols, portfolio, positions_by_symbol });

    this.#logger?.info({
      baseSymbolCount: baseSymbols.length,
      localSymbolCount: symbols.length - baseSymbols.length,
      totalSymbolCount: symbols.length,
    }, "Resolved scanner universe with portfolio context");

    return { portfolio, positions_by_symbol, symbols };
  }

  getPositionContext({ symbol, ltp, portfolioScanContext }) {
    const normalized_symbol = normalizeSymbol(symbol);
    const holding = portfolioScanContext?.positions_by_symbol?.get(normalized_symbol);

    if (!holding) return this.#buildEmptyContext();
    return this.#buildHoldingContext({ holding, ltp, capital: portfolioScanContext.portfolio.capital });
  }

  #buildPositionMap(holdings) {
    return holdings.reduce((positions_by_symbol, holding) => {
      const normalized_symbol = normalizeSymbol(holding.symbol);
      if (!normalized_symbol) return positions_by_symbol;

      positions_by_symbol.set(normalized_symbol, this.#normalizeHolding({ ...holding, symbol: normalized_symbol }));
      return positions_by_symbol;
    }, new Map());
  }

  #normalizeHolding(holding) {
    return {
      symbol: holding.symbol,
      quantity: this.#toNumber(holding.quantity),
      average_price: this.#toNumber(holding.average_price),
      product: holding.product || "DELIVERY",
      notes: holding.notes || null,
    };
  }

  #mergeSymbols({ baseSymbols, portfolio, positions_by_symbol }) {
    const merged_symbols = new Set(baseSymbols.map(normalizeSymbol).filter(Boolean));

    positions_by_symbol.forEach((holding) => merged_symbols.add(holding.symbol));
    portfolio.watchlist.map((item) => normalizeSymbol(item.symbol)).filter(Boolean).forEach((symbol) => {
      merged_symbols.add(symbol);
    });

    return Array.from(merged_symbols);
  }

  #buildEmptyContext() {
    return {
      has_position: false,
      source: POSITION_CONTEXT_SOURCE.NONE,
      delivery_fallback: { is_allowed: false, reason: "No existing delivery position" },
      interpretation: "No existing position found in local portfolio JSON.",
    };
  }

  #buildHoldingContext({ holding, ltp, capital }) {
    const position_value = holding.quantity * ltp;
    const invested_value = holding.quantity * holding.average_price;
    const unrealized_pnl = position_value - invested_value;

    return {
      has_position: true,
      quantity: holding.quantity,
      average_price: holding.average_price,
      position_value: roundNumber(position_value),
      allocation_percent: this.#calculateAllocation({ position_value, capital }),
      unrealized_pnl: roundNumber(unrealized_pnl),
      unrealized_pnl_percent: this.#calculatePnlPercent({ unrealized_pnl, invested_value }),
      product: holding.product,
      notes: holding.notes,
      source: POSITION_CONTEXT_SOURCE.LOCAL_JSON,
      delivery_fallback: this.#buildDeliveryFallback(),
      interpretation: "Existing holding: treat this as an intraday setup; delivery fallback is conditional.",
    };
  }

  #buildDeliveryFallback() {
    return {
      is_allowed: true,
      reason: "Allowed only if swing context remains valid; never use it to ignore a failed intraday stop loss.",
    };
  }

  #calculateAllocation({ position_value, capital }) {
    if (!capital || capital <= 0) return null;
    return roundNumber((position_value / capital) * 100);
  }

  #calculatePnlPercent({ unrealized_pnl, invested_value }) {
    if (!invested_value || invested_value <= 0) return null;
    return roundNumber((unrealized_pnl / invested_value) * 100);
  }

  #toNumber(value) {
    const numeric_value = Number(value);
    return Number.isFinite(numeric_value) ? numeric_value : 0;
  }
}

module.exports = {
  POSITION_CONTEXT_SOURCE,
  PortfolioContextService,
  normalizeSymbol,
};
