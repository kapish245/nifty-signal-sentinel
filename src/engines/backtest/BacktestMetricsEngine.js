const { BACKTEST_OUTCOMES } = require("./BacktestOutcomeEngine");

function roundNumber(value) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(4));
}

class BacktestMetricsEngine {
  summarize(results) {
    const backtest_results = Array.isArray(results) ? results : [];
    const entered_results = backtest_results.filter((result) => result.entry);
    const target_hits = this.#filterByOutcome(backtest_results, BACKTEST_OUTCOMES.TARGET_HIT);
    const stop_hits = this.#filterByOutcome(backtest_results, BACKTEST_OUTCOMES.STOP_LOSS_HIT);
    const ambiguous_hits = this.#filterByOutcome(backtest_results, BACKTEST_OUTCOMES.AMBIGUOUS_STOP_AND_TARGET);
    const no_entries = this.#filterByOutcome(backtest_results, BACKTEST_OUTCOMES.NO_ENTRY);
    const open_results = this.#filterByOutcome(backtest_results, BACKTEST_OUTCOMES.OPEN_AT_END);

    return {
      total_signals: backtest_results.length,
      entered_trades: entered_results.length,
      target_hits: target_hits.length,
      stop_hits: stop_hits.length,
      ambiguous_hits: ambiguous_hits.length,
      no_entries: no_entries.length,
      open_at_end: open_results.length,
      win_rate: this.#percentage(target_hits.length, entered_results.length),
      stop_rate: this.#percentage(stop_hits.length + ambiguous_hits.length, entered_results.length),
      average_r: this.#averageR(entered_results),
      expectancy_r: this.#averageR(entered_results),
      max_drawdown_r: this.#calculateMaxDrawdown(entered_results),
      signal_type_counts: this.#countBySignalType(backtest_results),
      outcome_counts: this.#countByOutcome(backtest_results),
    };
  }

  #filterByOutcome(results, outcome) {
    return results.filter((result) => result.outcome === outcome);
  }

  #percentage(numerator, denominator) {
    if (!denominator) return 0;
    return roundNumber((numerator / denominator) * 100);
  }

  #averageR(results) {
    if (results.length === 0) return 0;
    const total_r = results.reduce((sum, result) => sum + (Number(result.r_multiple) || 0), 0);
    return roundNumber(total_r / results.length);
  }

  #calculateMaxDrawdown(results) {
    let equity = 0;
    let peak = 0;
    let max_drawdown = 0;

    for (const result of results) {
      equity += Number(result.r_multiple) || 0;
      peak = Math.max(peak, equity);
      max_drawdown = Math.min(max_drawdown, equity - peak);
    }

    return roundNumber(Math.abs(max_drawdown));
  }

  #countBySignalType(results) {
    return results.reduce((counts, result) => {
      const key = result.signal_type || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  #countByOutcome(results) {
    return results.reduce((counts, result) => {
      const key = result.outcome || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }
}

module.exports = {
  BacktestMetricsEngine,
};
