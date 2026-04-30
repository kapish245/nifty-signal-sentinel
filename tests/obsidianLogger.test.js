const { formatSignalMarkdown } = require("../src/logger/obsidianLogger");

describe("obsidianLogger", () => {
  it("formats actionable intraday signals as trading journal entries", () => {
    const markdown = formatSignalMarkdown({
      timestamp: new Date("2026-04-30T05:00:00.000Z"),
      run_id: "run_1",
      scan_id: "scan_1",
      symbol_analysis_id: "symbol_1",
      signal_id: "signal_1",
      symbol: "NSE:INFY",
      signal_type: "INTRADAY_LONG",
      trade_action: "BUY",
      ltp: 1500,
      entry_zone: { min: 1497, max: 1503 },
      stop_loss: 1488,
      targets: [1515, 1524],
      risk_reward: 1.5,
      confidence_score: 77,
      valid_until: "2026-04-30T05:30:00.000Z",
      setup_name: "bullish_continuation_contract_mapping",
      invalidation_reason: "Avoid if price loses VWAP.",
      reason: "Bullish continuation",
      indicators: {
        rsi: 61,
        emaAlignment: "bullish",
        volume: "increasing",
        oiSignal: "long_buildup",
      },
    });

    expect(markdown).toContain("NSE:INFY - INTRADAY_LONG");
    expect(markdown).toContain("- Signal ID: signal_1");
    expect(markdown).toContain("- Entry: 1497 - 1503");
    expect(markdown).toContain("- Stop Loss: 1488");
    expect(markdown).toContain("- Confidence: 77%");
    expect(markdown).toContain("### Post-Market Review");
  });
});
