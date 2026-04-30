const { OPTION_TYPES, OptionChainNormalizer } = require("./OptionChainNormalizer");

const DERIVATIVES_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
};

class DerivativesOiEngine {
  #normalizer;

  constructor({ normalizer = new OptionChainNormalizer() } = {}) {
    this.#normalizer = normalizer;
  }

  analyze(optionChain) {
    const normalized = this.#normalizer.normalize(optionChain);

    if (normalized.contracts.length === 0) {
      return this.#buildUnavailable(normalized, "NO_OPTION_CONTRACTS");
    }

    const totals = this.#getTotals(normalized.contracts);
    const pcr = this.#getPcr(totals);
    const levels = this.#getOiLevels(normalized);
    const maxPain = this.#getMaxPain(normalized.contracts);
    const derivativesBias = this.#getDerivativesBias({ pcr, levels, spotPrice: normalized.spotPrice });

    return {
      status: DERIVATIVES_STATUS.AVAILABLE,
      underlying: normalized.underlying,
      expiry: normalized.expiry,
      pcr,
      totalCallOi: totals.callOi,
      totalPutOi: totals.putOi,
      maxPain,
      oiSupport: levels.oiSupport,
      oiResistance: levels.oiResistance,
      callWall: levels.callWall,
      putWall: levels.putWall,
      derivativesBias,
      buildupSignal: this.#getBuildupSignal({ derivativesBias, pcr }),
      contractCount: normalized.contracts.length,
      reason: this.#getReason({ derivativesBias, pcr, levels }),
    };
  }

  #buildUnavailable(normalized, reason) {
    return {
      status: DERIVATIVES_STATUS.UNAVAILABLE,
      underlying: normalized.underlying,
      expiry: normalized.expiry,
      pcr: null,
      totalCallOi: 0,
      totalPutOi: 0,
      maxPain: null,
      oiSupport: null,
      oiResistance: null,
      callWall: null,
      putWall: null,
      derivativesBias: "neutral",
      buildupSignal: "neutral",
      contractCount: 0,
      reason,
    };
  }

  #getTotals(contracts) {
    return contracts.reduce(
      (totals, contract) => {
        if (contract.optionType === OPTION_TYPES.CALL) totals.callOi += contract.oi;
        if (contract.optionType === OPTION_TYPES.PUT) totals.putOi += contract.oi;
        return totals;
      },
      { callOi: 0, putOi: 0 },
    );
  }

  #getPcr({ callOi, putOi }) {
    if (callOi <= 0) {
      return null;
    }

    return Number((putOi / callOi).toFixed(2));
  }

  #getOiLevels({ contracts, spotPrice }) {
    const calls = contracts.filter((contract) => contract.optionType === OPTION_TYPES.CALL);
    const puts = contracts.filter((contract) => contract.optionType === OPTION_TYPES.PUT);

    return {
      callWall: this.#getHighestOiStrike(calls),
      putWall: this.#getHighestOiStrike(puts),
      oiResistance: this.#getNearestWall({ contracts: calls, spotPrice, direction: "above" }),
      oiSupport: this.#getNearestWall({ contracts: puts, spotPrice, direction: "below" }),
    };
  }

  #getHighestOiStrike(contracts) {
    const highest = [...contracts].sort((left, right) => right.oi - left.oi)[0];
    return highest?.strike || null;
  }

  #getNearestWall({ contracts, spotPrice, direction }) {
    const candidates = contracts.filter((contract) => {
      if (direction === "above") return contract.strike >= spotPrice;
      return contract.strike <= spotPrice;
    });
    const sorted = candidates.sort((left, right) => right.oi - left.oi);

    return sorted[0]?.strike || null;
  }

  #getMaxPain(contracts) {
    const strikes = [...new Set(contracts.map((contract) => contract.strike))].sort((left, right) => left - right);
    const pains = strikes.map((strike) => ({
      strike,
      pain: this.#getPainAtStrike({ contracts, strike }),
    }));

    return pains.sort((left, right) => left.pain - right.pain)[0]?.strike || null;
  }

  #getPainAtStrike({ contracts, strike }) {
    return contracts.reduce((pain, contract) => {
      if (contract.optionType === OPTION_TYPES.CALL) return pain + Math.max(0, strike - contract.strike) * contract.oi;
      return pain + Math.max(0, contract.strike - strike) * contract.oi;
    }, 0);
  }

  #getDerivativesBias({ pcr, levels, spotPrice }) {
    if (pcr === null) return "neutral";
    if (pcr >= 1.05 && levels.oiSupport && levels.oiSupport <= spotPrice) return "bullish";
    if (pcr <= 0.75 && levels.oiResistance && levels.oiResistance >= spotPrice) return "bearish";
    return "neutral";
  }

  #getBuildupSignal({ derivativesBias, pcr }) {
    if (derivativesBias === "bullish" && pcr >= 1.05) return "long_buildup";
    if (derivativesBias === "bearish" && pcr <= 0.75) return "short_buildup";
    return "neutral";
  }

  #getReason({ derivativesBias, pcr, levels }) {
    return `Derivatives bias ${derivativesBias}; PCR ${pcr ?? "n/a"}; `
      + `OI support ${levels.oiSupport ?? "n/a"}; OI resistance ${levels.oiResistance ?? "n/a"}`;
  }
}

module.exports = {
  DERIVATIVES_STATUS,
  DerivativesOiEngine,
};
