const {
  ACTIONABLE_SIGNAL_TYPES,
  SIGNAL_TYPES,
  TRADE_ACTIONS,
} = require("./SignalTypes");
const { ConfidenceScorer, calculateConfidence } = require("./ConfidenceScorer");
const { RiskManager } = require("./RiskManager");

function buildValidity({ now_provider, validity_minutes }) {
  const valid_until = new Date(now_provider().getTime() + validity_minutes * 60 * 1000);

  return valid_until.toISOString();
}

class SignalContractBuilder {
  #now_provider;

  #validity_minutes;

  #risk_manager;

  #confidence_scorer;

  constructor({
    now_provider = () => new Date(),
    validity_minutes = 30,
    risk_manager = new RiskManager(),
    confidence_scorer = new ConfidenceScorer(),
  } = {}) {
    this.#now_provider = now_provider;
    this.#validity_minutes = validity_minutes;
    this.#risk_manager = risk_manager;
    this.#confidence_scorer = confidence_scorer;
  }

  build({ symbol, ltp, signal_type, indicators, reason, meta = {}, ids = {}, signal_id }) {
    const risk_payload = this.#buildRiskPayload({ signal_type, ltp, indicators });
    const confidence_score = this.#confidence_scorer.calculate({ signal_type, indicators, meta });

    return {
      ...ids,
      signal_id,
      symbol,
      ltp,
      signal_type,
      signal: signal_type,
      trade_action: this.#getTradeAction(signal_type),
      ...risk_payload,
      confidence_score,
      valid_until: this.#getValidUntil(signal_type),
      setup_name: this.#getSetupName(signal_type),
      reason: reason || "No clear intraday setup detected",
      invalidation_reason: this.#getInvalidationReason(signal_type, risk_payload),
      evidence: this.#buildEvidence({ indicators, meta }),
      indicators,
      meta,
    };
  }

  buildNoTrade({ symbol, ltp, reason, indicators = null, meta = {}, ids = {} }) {
    return this.build({
      symbol,
      ltp,
      signal_type: SIGNAL_TYPES.NO_TRADE,
      indicators,
      reason,
      meta,
      ids,
    });
  }

  #buildRiskPayload({ signal_type, ltp, indicators }) {
    if (signal_type === SIGNAL_TYPES.INTRADAY_LONG) return this.#risk_manager.buildLongRisk({ ltp, indicators });
    if (signal_type === SIGNAL_TYPES.INTRADAY_SHORT) return this.#risk_manager.buildShortRisk({ ltp, indicators });

    return this.#risk_manager.buildNoTradeRisk();
  }

  #getTradeAction(signal_type) {
    if (signal_type === SIGNAL_TYPES.INTRADAY_LONG) return TRADE_ACTIONS.BUY;
    if (signal_type === SIGNAL_TYPES.INTRADAY_SHORT) return TRADE_ACTIONS.SELL;
    if (signal_type.startsWith("WAIT_FOR")) return TRADE_ACTIONS.WAIT;
    if (signal_type === SIGNAL_TYPES.AVOID) return TRADE_ACTIONS.AVOID;
    return TRADE_ACTIONS.NONE;
  }

  #getValidUntil(signal_type) {
    if (!ACTIONABLE_SIGNAL_TYPES.has(signal_type)) return null;
    return buildValidity({
      now_provider: this.#now_provider,
      validity_minutes: this.#validity_minutes,
    });
  }

  #getSetupName(signal_type) {
    if (signal_type === SIGNAL_TYPES.INTRADAY_LONG) return "bullish_continuation_contract_mapping";
    if (signal_type === SIGNAL_TYPES.INTRADAY_SHORT) return "bearish_breakdown_contract_mapping";
    if (signal_type === SIGNAL_TYPES.NO_TRADE) return "no_trade";
    return "wait_for_clean_setup";
  }

  #getInvalidationReason(signal_type, risk_payload) {
    if (signal_type === SIGNAL_TYPES.INTRADAY_LONG) {
      return `Do not enter if price falls below ${risk_payload.entry_zone.min}. `
        + `If already entered, exit near stop loss ${risk_payload.stop_loss}.`;
    }

    if (signal_type === SIGNAL_TYPES.INTRADAY_SHORT) {
      return `Do not enter if price moves above ${risk_payload.entry_zone.max}. `
        + `If already entered, exit near stop loss ${risk_payload.stop_loss}.`;
    }

    return "No trade is valid until a cleaner intraday setup appears.";
  }

  #buildEvidence({ indicators, meta }) {
    return {
      price_trend: indicators?.priceTrend || null,
      ema_alignment: indicators?.emaAlignment || null,
      rsi: typeof indicators?.rsi === "number" ? Number(indicators.rsi.toFixed(2)) : null,
      volume: indicators?.volume || null,
      oi_signal: indicators?.oiSignal || null,
      vwap: indicators?.vwap || null,
      atr: indicators?.atr || null,
      macd_bias: indicators?.macd?.bias || null,
      support: indicators?.support || null,
      resistance: indicators?.resistance || null,
      breakout: indicators?.breakout?.type || null,
      multi_timeframe_bias: indicators?.multiTimeframeBias || null,
      sufficiency_mode: meta?.sufficiencyMode || null,
      is_degraded: Boolean(meta?.isDegraded),
      source: "phase_4_technical_engine",
    };
  }
}

module.exports = {
  ACTIONABLE_SIGNAL_TYPES,
  SIGNAL_TYPES,
  TRADE_ACTIONS,
  SignalContractBuilder,
  calculateConfidence,
};
