const { parseObsidianSignals } = require("../src/services/BacktestSignalLoader");

describe("BacktestSignalLoader", () => {
  it("parses Obsidian signal markdown into structured signal contracts", () => {
    const signals = parseObsidianSignals(`
## 14:46 - NSE:ADANIENT - INTRADAY_LONG

- Signal ID: signal_1
- Run ID: run_1
- Scan ID: scan_1
- Symbol Analysis ID: symbol_1

### Trade Plan

- Action: BUY
- Price: 2398.3
- Entry: 2393.5 - 2403.1
- Stop Loss: 2379.11
- Targets: 2422.28 / 2436.67
- Risk Reward: 0.8
- Confidence: 77%
- Valid Until: 2026-04-30T09:46:04.580Z

### Evidence

- Setup: bullish_continuation_contract_mapping
- Reason: Bullish continuation
- Invalidation: Do not enter if price falls below 2393.5.
`);

    expect(signals).toEqual([
      expect.objectContaining({
        timestamp: "2026-04-30T09:16:04.580Z",
        signal_id: "signal_1",
        symbol: "NSE:ADANIENT",
        signal_type: "INTRADAY_LONG",
        trade_action: "BUY",
        ltp: 2398.3,
        entry_zone: { min: 2393.5, max: 2403.1 },
        stop_loss: 2379.11,
        targets: [2422.28, 2436.67],
        confidence_score: 77,
        source: "obsidian_markdown",
      }),
    ]);
  });
});
