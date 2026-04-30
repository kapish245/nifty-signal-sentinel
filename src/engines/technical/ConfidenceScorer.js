const { SIGNAL_TYPES } = require("./SignalTypes");

class ConfidenceScorer {
  calculate({ signal_type, indicators, meta }) {
    if (signal_type === SIGNAL_TYPES.NO_TRADE || signal_type === SIGNAL_TYPES.AVOID) {
      return 0;
    }

    const capped_score = this.#capScore({
      score: this.#calculateRawScore({ signal_type, indicators }),
      meta,
    });

    return Math.min(capped_score, 82);
  }

  #calculateRawScore({ signal_type, indicators }) {
    let score = this.#getBaseScore(signal_type);

    if (indicators?.volume === "increasing") score += 4;
    if (["long_buildup", "short_buildup", "short_covering"].includes(indicators?.oiSignal)) score += 3;
    if (typeof indicators?.rsi === "number" && indicators.rsi > 58 && indicators.rsi < 68) score += 2;
    if (indicators?.breakout?.isConfirmed) score += 5;
    if (indicators?.multiTimeframeBias === "bullish" && signal_type === SIGNAL_TYPES.INTRADAY_LONG) score += 4;
    if (indicators?.multiTimeframeBias === "bearish" && signal_type === SIGNAL_TYPES.INTRADAY_SHORT) score += 4;
    if (indicators?.macd?.bias === "bullish" && signal_type === SIGNAL_TYPES.INTRADAY_LONG) score += 2;
    if (indicators?.macd?.bias === "bearish" && signal_type === SIGNAL_TYPES.INTRADAY_SHORT) score += 2;

    return score;
  }

  #getBaseScore(signal_type) {
    if ([SIGNAL_TYPES.INTRADAY_LONG, SIGNAL_TYPES.INTRADAY_SHORT].includes(signal_type)) {
      return 68;
    }

    return 52;
  }

  #capScore({ score, meta }) {
    if (meta?.isDegraded && score > 60) {
      return 60;
    }

    return score;
  }
}

function calculateConfidence(payload) {
  return new ConfidenceScorer().calculate(payload);
}

module.exports = {
  ConfidenceScorer,
  calculateConfidence,
};
