function roundPrice(price) {
  return Number(price.toFixed(2));
}

class RiskManager {
  buildLongRisk({ ltp, indicators }) {
    const atr = this.#getAtr(indicators, ltp);
    const entry_min = roundPrice(ltp * 0.998);
    const entry_max = roundPrice(ltp * 1.002);
    const support_stop = typeof indicators?.support === "number" ? indicators.support - atr * 0.2 : null;
    const stop_loss = roundPrice(this.#getLongStop({ ltp, atr, support_stop }));
    const targets = this.#buildLongTargets({ ltp, atr, resistance: indicators?.resistance });

    return this.#buildRiskPayload({
      entry_zone: { min: entry_min, max: entry_max },
      stop_loss,
      targets,
      risk: entry_max - stop_loss,
      reward: targets[0] - entry_max,
    });
  }

  buildShortRisk({ ltp, indicators }) {
    const atr = this.#getAtr(indicators, ltp);
    const entry_min = roundPrice(ltp * 0.998);
    const entry_max = roundPrice(ltp * 1.002);
    const resistance_stop = typeof indicators?.resistance === "number" ? indicators.resistance + atr * 0.2 : null;
    const stop_loss = roundPrice(this.#getShortStop({ ltp, atr, resistance_stop }));
    const targets = this.#buildShortTargets({ ltp, atr, support: indicators?.support });

    return this.#buildRiskPayload({
      entry_zone: { min: entry_min, max: entry_max },
      stop_loss,
      targets,
      risk: stop_loss - entry_min,
      reward: entry_min - targets[0],
    });
  }

  buildNoTradeRisk() {
    return {
      entry_zone: null,
      stop_loss: null,
      targets: [],
      risk_reward: null,
    };
  }

  #buildRiskPayload({ entry_zone, stop_loss, targets, risk, reward }) {
    return {
      entry_zone,
      stop_loss,
      targets,
      risk_reward: risk > 0 ? Number((reward / risk).toFixed(2)) : null,
    };
  }

  #getAtr(indicators, ltp) {
    if (typeof indicators?.atr === "number" && indicators.atr > 0) {
      return indicators.atr;
    }

    return ltp * 0.008;
  }

  #buildLongTargets({ ltp, atr, resistance }) {
    const target1 = typeof resistance === "number" && resistance > ltp
      ? resistance
      : ltp + atr * 1.5;

    return [roundPrice(target1), roundPrice(ltp + atr * 2.4)];
  }

  #buildShortTargets({ ltp, atr, support }) {
    const target1 = typeof support === "number" && support < ltp
      ? support
      : ltp - atr * 1.5;

    return [roundPrice(target1), roundPrice(ltp - atr * 2.4)];
  }

  #getLongStop({ ltp, atr, support_stop }) {
    const default_stop = ltp - atr;
    const is_nearby_support = typeof support_stop === "number" &&
      support_stop < ltp &&
      ltp - support_stop <= atr * 2.2;

    return is_nearby_support ? Math.min(default_stop, support_stop) : default_stop;
  }

  #getShortStop({ ltp, atr, resistance_stop }) {
    const default_stop = ltp + atr;
    const is_nearby_resistance = typeof resistance_stop === "number" &&
      resistance_stop > ltp &&
      resistance_stop - ltp <= atr * 2.2;

    return is_nearby_resistance ? Math.max(default_stop, resistance_stop) : default_stop;
  }
}

module.exports = {
  RiskManager,
  roundPrice,
};
