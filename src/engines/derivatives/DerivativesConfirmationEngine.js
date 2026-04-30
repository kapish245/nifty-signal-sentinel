const { SIGNAL_TYPES } = require("../technical/SignalTypes");

const OI_CONFIRMATION = {
  CONFIRMS: "confirms",
  CONFLICTS: "conflicts",
  NEUTRAL: "neutral",
  UNAVAILABLE: "unavailable",
};

class DerivativesConfirmationEngine {
  confirm({ signal_type, derivatives }) {
    if (!derivatives || derivatives.status !== "available") {
      return {
        oiConfirmation: OI_CONFIRMATION.UNAVAILABLE,
        confirmationReason: derivatives?.reason || "Derivatives data unavailable",
      };
    }

    if (this.#isConfirmed({ signal_type, derivatives })) {
      return this.#buildResult(OI_CONFIRMATION.CONFIRMS, derivatives);
    }

    if (this.#isConflicting({ signal_type, derivatives })) {
      return this.#buildResult(OI_CONFIRMATION.CONFLICTS, derivatives);
    }

    return this.#buildResult(OI_CONFIRMATION.NEUTRAL, derivatives);
  }

  #isConfirmed({ signal_type, derivatives }) {
    return (
      signal_type === SIGNAL_TYPES.INTRADAY_LONG &&
      derivatives.derivativesBias === "bullish"
    ) || (
      signal_type === SIGNAL_TYPES.INTRADAY_SHORT &&
      derivatives.derivativesBias === "bearish"
    );
  }

  #isConflicting({ signal_type, derivatives }) {
    return (
      signal_type === SIGNAL_TYPES.INTRADAY_LONG &&
      derivatives.derivativesBias === "bearish"
    ) || (
      signal_type === SIGNAL_TYPES.INTRADAY_SHORT &&
      derivatives.derivativesBias === "bullish"
    );
  }

  #buildResult(oiConfirmation, derivatives) {
    return {
      oiConfirmation,
      confirmationReason: derivatives.reason,
    };
  }
}

module.exports = {
  OI_CONFIRMATION,
  DerivativesConfirmationEngine,
};
