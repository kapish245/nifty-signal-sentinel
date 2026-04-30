const DiscordWebhookAdapter = require("../src/adapters/discord/DiscordWebhookAdapter");
const KiteAuthAdapter = require("../src/adapters/zerodha/KiteAuthAdapter");
const KiteDerivativesAdapter = require("../src/adapters/zerodha/KiteDerivativesAdapter");
const KiteHistoricalAdapter = require("../src/adapters/zerodha/KiteHistoricalAdapter");
const KiteQuoteAdapter = require("../src/adapters/zerodha/KiteQuoteAdapter");
const ScannerController = require("../src/controllers/ScannerController");
const { PortfolioRepository } = require("../src/repositories/PortfolioRepository");
const { PortfolioContextService } = require("../src/services/PortfolioContextService");
const RuntimeService = require("../src/services/RuntimeService");
const {
  IntradaySignalEngine,
} = require("../src/engines/technical/IntradaySignalEngine");
const { RiskManager } = require("../src/engines/technical/RiskManager");
const { ConfidenceScorer } = require("../src/engines/technical/ConfidenceScorer");
const { DerivativesOiEngine } = require("../src/engines/derivatives/DerivativesOiEngine");

describe("hexagonal architecture boundaries", () => {
  it("exposes Discord adapter for alert delivery", () => {
    expect(new DiscordWebhookAdapter({
      httpClient: { post: jest.fn() },
      isEnabled: false,
    })).toEqual(expect.any(DiscordWebhookAdapter));
  });

  it("exposes Zerodha adapters for external Kite dependencies", () => {
    expect(new KiteAuthAdapter()).toEqual(expect.any(KiteAuthAdapter));
    expect(new KiteQuoteAdapter({
      client: { getLTP: jest.fn() },
    })).toEqual(expect.any(KiteQuoteAdapter));
    expect(new KiteHistoricalAdapter({
      client: {
        getHistoricalCandles: jest.fn(),
        getHistoricalCandlesByCount: jest.fn(),
      },
    })).toEqual(expect.any(KiteHistoricalAdapter));
    expect(new KiteDerivativesAdapter({
      client: { getOptionChain: jest.fn() },
    })).toEqual(expect.any(KiteDerivativesAdapter));
  });

  it("keeps technical decision components under engine layer", () => {
    expect(new IntradaySignalEngine()).toEqual(expect.any(IntradaySignalEngine));
    expect(new RiskManager()).toEqual(expect.any(RiskManager));
    expect(new ConfidenceScorer()).toEqual(expect.any(ConfidenceScorer));
    expect(new DerivativesOiEngine()).toEqual(expect.any(DerivativesOiEngine));
  });

  it("keeps portfolio context behind repository and service boundaries", () => {
    const portfolioRepository = new PortfolioRepository({ filePath: "/tmp/portfolio.json" });

    expect(portfolioRepository).toEqual(expect.any(PortfolioRepository));
    expect(new PortfolioContextService({ portfolioRepository })).toEqual(expect.any(PortfolioContextService));
  });

  it("lets scanner controller run through runtime service", async () => {
    const scanMarket = jest.fn().mockResolvedValue({ matches: [] });
    const runtimeService = {
      createRuntime: jest.fn().mockResolvedValue({
        scannerService: { scanMarket },
      }),
    };
    const printSignals = jest.fn();
    const controller = new ScannerController({ runtimeService, printSignals });

    await controller.runOnce();

    expect(runtimeService.createRuntime).toHaveBeenCalled();
    expect(scanMarket).toHaveBeenCalled();
    expect(printSignals).toHaveBeenCalledWith([]);
  });

  it("keeps runtime service as the composition root", () => {
    expect(new RuntimeService()).toEqual(expect.any(RuntimeService));
  });
});
