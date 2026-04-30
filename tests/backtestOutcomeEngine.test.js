const { BACKTEST_OUTCOMES, BacktestOutcomeEngine } = require("../src/engines/backtest/BacktestOutcomeEngine");
const { BacktestMetricsEngine } = require("../src/engines/backtest/BacktestMetricsEngine");

function buildSignal(overrides = {}) {
  return {
    timestamp: "2026-04-30T09:15:00.000Z",
    symbol: "NSE:TEST",
    signal_type: "INTRADAY_LONG",
    trade_action: "BUY",
    ltp: 100,
    entry_zone: { min: 99, max: 101 },
    stop_loss: 95,
    targets: [105, 110],
    ...overrides,
  };
}

function candle({ minute, open = 100, high = 101, low = 99, close = 100 }) {
  return {
    timestamp: `2026-04-30T09:${String(15 + minute).padStart(2, "0")}:00.000Z`,
    open,
    high,
    low,
    close,
    volume: 1000,
  };
}

describe("BacktestOutcomeEngine", () => {
  const engine = new BacktestOutcomeEngine();

  it.each([
    {
      name: "long trend day reaches first target",
      signal: buildSignal(),
      candles: [candle({ minute: 1, high: 106, low: 99 })],
      outcome: BACKTEST_OUTCOMES.TARGET_HIT,
      r_multiple: 1,
    },
    {
      name: "long strong trend reaches second target",
      signal: buildSignal(),
      candles: [candle({ minute: 1, high: 111, low: 99 })],
      outcome: BACKTEST_OUTCOMES.TARGET_HIT,
      r_multiple: 2,
    },
    {
      name: "long false breakout hits stop",
      signal: buildSignal(),
      candles: [candle({ minute: 1, high: 102, low: 94 })],
      outcome: BACKTEST_OUTCOMES.STOP_LOSS_HIT,
      r_multiple: -1,
    },
    {
      name: "long sideways chop remains open",
      signal: buildSignal(),
      candles: [candle({ minute: 1, high: 103, low: 97, close: 102 })],
      outcome: BACKTEST_OUTCOMES.OPEN_AT_END,
      r_multiple: 0.4,
    },
    {
      name: "long gap-up never gives entry",
      signal: buildSignal({ ltp: 104 }),
      candles: [candle({ minute: 1, open: 106, high: 108, low: 105, close: 107 })],
      outcome: BACKTEST_OUTCOMES.NO_ENTRY,
      r_multiple: 0,
    },
    {
      name: "long high-volatility candle is ambiguous",
      signal: buildSignal(),
      candles: [candle({ minute: 1, high: 106, low: 94 })],
      outcome: BACKTEST_OUTCOMES.AMBIGUOUS_STOP_AND_TARGET,
      r_multiple: -1,
    },
    {
      name: "short breakdown reaches first target",
      signal: buildSignal({
        signal_type: "INTRADAY_SHORT",
        trade_action: "SELL",
        stop_loss: 105,
        targets: [95, 90],
      }),
      candles: [candle({ minute: 1, high: 101, low: 94 })],
      outcome: BACKTEST_OUTCOMES.TARGET_HIT,
      r_multiple: 1,
    },
    {
      name: "short trend day reaches second target",
      signal: buildSignal({
        signal_type: "INTRADAY_SHORT",
        trade_action: "SELL",
        stop_loss: 105,
        targets: [95, 90],
      }),
      candles: [candle({ minute: 1, high: 101, low: 89 })],
      outcome: BACKTEST_OUTCOMES.TARGET_HIT,
      r_multiple: 2,
    },
    {
      name: "short reversal hits stop",
      signal: buildSignal({
        signal_type: "INTRADAY_SHORT",
        trade_action: "SELL",
        stop_loss: 105,
        targets: [95, 90],
      }),
      candles: [candle({ minute: 1, high: 106, low: 98 })],
      outcome: BACKTEST_OUTCOMES.STOP_LOSS_HIT,
      r_multiple: -1,
    },
    {
      name: "short gap-down never gives entry",
      signal: buildSignal({
        signal_type: "INTRADAY_SHORT",
        trade_action: "SELL",
        ltp: 96,
        stop_loss: 105,
        targets: [95, 90],
      }),
      candles: [candle({ minute: 1, open: 94, high: 95, low: 92, close: 93 })],
      outcome: BACKTEST_OUTCOMES.NO_ENTRY,
      r_multiple: 0,
    },
    {
      name: "late-day short remains open at end",
      signal: buildSignal({
        signal_type: "INTRADAY_SHORT",
        trade_action: "SELL",
        stop_loss: 105,
        targets: [95, 90],
      }),
      candles: [candle({ minute: 1, high: 102, low: 97, close: 98 })],
      outcome: BACKTEST_OUTCOMES.OPEN_AT_END,
      r_multiple: 0.4,
    },
    {
      name: "expired pullback setup is no entry",
      signal: buildSignal({
        ltp: 104,
        valid_until: "2026-04-30T09:15:30.000Z",
      }),
      candles: [candle({ minute: 1, high: 105, low: 99 })],
      outcome: BACKTEST_OUTCOMES.NO_ENTRY,
      r_multiple: 0,
    },
  ])("$name", ({ signal, candles, outcome, r_multiple }) => {
    const result = engine.evaluate({ signal, candles });

    expect(result.outcome).toBe(outcome);
    expect(result.r_multiple).toBe(r_multiple);
  });
});

describe("BacktestMetricsEngine", () => {
  it("summarizes win rate, stop rate, expectancy, and drawdown", () => {
    const metrics = new BacktestMetricsEngine().summarize([
      { signal_type: "INTRADAY_LONG", outcome: BACKTEST_OUTCOMES.TARGET_HIT, entry: {}, r_multiple: 1 },
      { signal_type: "INTRADAY_SHORT", outcome: BACKTEST_OUTCOMES.STOP_LOSS_HIT, entry: {}, r_multiple: -1 },
      { signal_type: "INTRADAY_LONG", outcome: BACKTEST_OUTCOMES.NO_ENTRY, entry: null, r_multiple: 0 },
    ]);

    expect(metrics).toMatchObject({
      total_signals: 3,
      entered_trades: 2,
      target_hits: 1,
      stop_hits: 1,
      no_entries: 1,
      win_rate: 50,
      stop_rate: 50,
      average_r: 0,
      max_drawdown_r: 1,
      signal_type_counts: {
        INTRADAY_LONG: 2,
        INTRADAY_SHORT: 1,
      },
    });
  });
});
