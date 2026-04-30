const OPTION_TYPES = {
  CALL: "CE",
  PUT: "PE",
};

class OptionChainNormalizer {
  normalize(optionChain) {
    const contracts = Array.isArray(optionChain?.contracts) ? optionChain.contracts : [];

    return {
      underlying: optionChain?.underlying || null,
      spotPrice: optionChain?.spotPrice || null,
      expiry: optionChain?.expiry || null,
      contracts: contracts
        .filter((contract) => this.#isValidContract(contract))
        .map((contract) => this.#normalizeContract(contract)),
    };
  }

  #isValidContract(contract) {
    return contract &&
      Number.isFinite(contract.strike) &&
      [OPTION_TYPES.CALL, OPTION_TYPES.PUT].includes(contract.optionType);
  }

  #normalizeContract(contract) {
    return {
      ...contract,
      strike: Number(contract.strike),
      oi: Number.isFinite(contract.oi) ? contract.oi : 0,
      volume: Number.isFinite(contract.volume) ? contract.volume : 0,
      lastPrice: Number.isFinite(contract.lastPrice) ? contract.lastPrice : null,
      priceChange: Number.isFinite(contract.priceChange) ? contract.priceChange : null,
      oiChange: Number.isFinite(contract.oiChange) ? contract.oiChange : null,
    };
  }
}

module.exports = {
  OPTION_TYPES,
  OptionChainNormalizer,
};
