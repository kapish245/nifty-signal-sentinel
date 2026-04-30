const { RunContext } = require("../src/logger/RunContext");

describe("RunContext", () => {
  it("keeps run_id stable and creates scoped scan/symbol/signal ids", () => {
    let counter = 0;
    const runContext = new RunContext({
      now_provider: () => new Date("2026-04-30T04:00:00.000Z"),
      id_provider: () => {
        counter += 1;
        return `00000000-0000-0000-0000-${String(counter).padStart(12, "0")}`;
      },
    });

    const scanContext = runContext.createScanContext();
    const symbolContext = runContext.createSymbolAnalysisContext({
      scan_id: scanContext.scan_id,
      symbol: "NSE:INFY",
    });
    const signalId = runContext.createSignalId({
      symbol: "NSE:INFY",
      signal_type: "INTRADAY_LONG",
    });

    expect(scanContext.run_id).toBe(runContext.getRunId());
    expect(symbolContext.run_id).toBe(runContext.getRunId());
    expect(symbolContext.scan_id).toBe(scanContext.scan_id);
    expect(scanContext.scan_id).toContain("scan_20260430T040000Z");
    expect(symbolContext.symbol_analysis_id).toContain("symbol_20260430T040000Z_nse_infy");
    expect(signalId).toContain("signal_20260430T040000Z_nse_infy_intraday_long");
  });
});
