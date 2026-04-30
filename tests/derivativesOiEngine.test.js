const { DerivativesConfirmationEngine } = require("../src/engines/derivatives/DerivativesConfirmationEngine");
const { DerivativesOiEngine } = require("../src/engines/derivatives/DerivativesOiEngine");

function buildOptionChain() {
  return {
    underlying: "INFY",
    spotPrice: 1500,
    expiry: "2026-05-28",
    contracts: [
      { strike: 1480, optionType: "PE", oi: 900, volume: 120, lastPrice: 18 },
      { strike: 1500, optionType: "PE", oi: 1500, volume: 180, lastPrice: 28 },
      { strike: 1520, optionType: "PE", oi: 1100, volume: 130, lastPrice: 42 },
      { strike: 1480, optionType: "CE", oi: 500, volume: 90, lastPrice: 45 },
      { strike: 1500, optionType: "CE", oi: 700, volume: 100, lastPrice: 30 },
      { strike: 1520, optionType: "CE", oi: 900, volume: 110, lastPrice: 18 },
    ],
  };
}

describe("DerivativesOiEngine", () => {
  it("calculates PCR, max pain, OI levels and bullish bias", () => {
    const result = new DerivativesOiEngine().analyze(buildOptionChain());

    expect(result).toEqual(
      expect.objectContaining({
        status: "available",
        pcr: 1.67,
        maxPain: expect.any(Number),
        oiSupport: 1500,
        oiResistance: 1520,
        putWall: 1500,
        callWall: 1520,
        derivativesBias: "bullish",
        buildupSignal: "long_buildup",
      }),
    );
  });

  it("returns unavailable response when contracts are missing", () => {
    const result = new DerivativesOiEngine().analyze({ underlying: "INFY", contracts: [] });

    expect(result).toMatchObject({
      status: "unavailable",
      derivativesBias: "neutral",
      buildupSignal: "neutral",
      reason: "NO_OPTION_CONTRACTS",
    });
  });
});

describe("DerivativesConfirmationEngine", () => {
  it("confirms long signals when derivatives bias is bullish", () => {
    const result = new DerivativesConfirmationEngine().confirm({
      signal_type: "INTRADAY_LONG",
      derivatives: {
        status: "available",
        derivativesBias: "bullish",
        reason: "bullish derivatives",
      },
    });

    expect(result).toEqual({
      oiConfirmation: "confirms",
      confirmationReason: "bullish derivatives",
    });
  });

  it("marks conflict when derivatives oppose the signal", () => {
    const result = new DerivativesConfirmationEngine().confirm({
      signal_type: "INTRADAY_SHORT",
      derivatives: {
        status: "available",
        derivativesBias: "bullish",
        reason: "bullish derivatives",
      },
    });

    expect(result.oiConfirmation).toBe("conflicts");
  });
});
