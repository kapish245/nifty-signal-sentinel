const {
  SignalContractBuilder,
  SIGNAL_TYPES,
} = require("../src/signals/SignalContractBuilder");

describe("SignalContractBuilder", () => {
  it("builds actionable intraday long contract with risk details", () => {
    const builder = new SignalContractBuilder({
      now_provider: () => new Date("2026-04-30T05:00:00.000Z"),
      validity_minutes: 20,
    });

    const result = builder.build({
      symbol: "NSE:INFY",
      ltp: 1500,
      signal_type: SIGNAL_TYPES.INTRADAY_LONG,
      signal_id: "signal_1",
      ids: {
        run_id: "run_1",
        scan_id: "scan_1",
        symbol_analysis_id: "symbol_1",
      },
      indicators: {
        priceTrend: "up",
        emaAlignment: "bullish",
        rsi: 61,
        volume: "increasing",
        oiSignal: "long_buildup",
      },
      reason: "Bullish continuation",
      meta: {
        sufficiencyMode: "adaptive",
      },
    });

    expect(result).toMatchObject({
      run_id: "run_1",
      scan_id: "scan_1",
      symbol_analysis_id: "symbol_1",
      signal_id: "signal_1",
      symbol: "NSE:INFY",
      signal_type: "INTRADAY_LONG",
      signal: "INTRADAY_LONG",
      trade_action: "BUY",
      entry_zone: {
        min: expect.any(Number),
        max: expect.any(Number),
      },
      stop_loss: expect.any(Number),
      targets: expect.any(Array),
      risk_reward: expect.any(Number),
      confidence_score: expect.any(Number),
      valid_until: "2026-04-30T05:20:00.000Z",
      invalidation_reason: "Do not enter if price falls below 1497. If already entered, exit near stop loss 1488.",
      evidence: expect.objectContaining({
        source: "phase_5_derivatives_oi_layer",
      }),
    });
  });

  it("builds no-trade contract without trade levels", () => {
    const builder = new SignalContractBuilder();
    const result = builder.buildNoTrade({
      symbol: "NSE:INFY",
      ltp: 1500,
      reason: "INSUFFICIENT_DATA",
    });

    expect(result).toMatchObject({
      signal_type: "NO_TRADE",
      trade_action: "NONE",
      entry_zone: null,
      stop_loss: null,
      targets: [],
      confidence_score: 0,
      valid_until: null,
    });
  });
});
