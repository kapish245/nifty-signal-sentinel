const { BACKTEST_OUTCOMES, BacktestOutcomeEngine } = require("../engines/backtest/BacktestOutcomeEngine");
const { BacktestMetricsEngine } = require("../engines/backtest/BacktestMetricsEngine");

class BacktestService {
  #outcome_engine;

  #metrics_engine;

  #candle_provider;

  constructor({
    outcomeEngine = new BacktestOutcomeEngine(),
    metricsEngine = new BacktestMetricsEngine(),
    candleProvider,
  } = {}) {
    if (!candleProvider || typeof candleProvider.getCandlesForSignal !== "function") {
      throw new Error("candleProvider with getCandlesForSignal(signal) is required");
    }

    this.#outcome_engine = outcomeEngine;
    this.#metrics_engine = metricsEngine;
    this.#candle_provider = candleProvider;
  }

  async run({ signals }) {
    const backtest_signals = Array.isArray(signals) ? signals : [];
    const results = [];

    for (const signal of backtest_signals) {
      results.push(await this.#evaluateSignal(signal));
    }

    return {
      generated_at: new Date().toISOString(),
      metrics: this.#metrics_engine.summarize(results),
      results,
    };
  }

  async #evaluateSignal(signal) {
    try {
      const candles = await this.#candle_provider.getCandlesForSignal(signal);
      return this.#outcome_engine.evaluate({ signal, candles });
    } catch (error) {
      return {
        signal_id: signal?.signal_id || null,
        symbol: signal?.symbol || null,
        signal_type: signal?.signal_type || signal?.signal || null,
        outcome: BACKTEST_OUTCOMES.DATA_UNAVAILABLE,
        error: error.message,
        entry: null,
        exit: null,
        r_multiple: 0,
      };
    }
  }
}

module.exports = {
  BacktestService,
};
