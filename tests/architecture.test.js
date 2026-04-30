const KiteAuthAdapter = require("../src/adapters/zerodha/KiteAuthAdapter");
const KiteHistoricalAdapter = require("../src/adapters/zerodha/KiteHistoricalAdapter");
const KiteQuoteAdapter = require("../src/adapters/zerodha/KiteQuoteAdapter");
const ScannerController = require("../src/controllers/ScannerController");
const RuntimeService = require("../src/services/RuntimeService");
const {
  IntradaySignalEngine,
} = require("../src/engines/technical/IntradaySignalEngine");
const { RiskManager } = require("../src/engines/technical/RiskManager");
const { ConfidenceScorer } = require("../src/engines/technical/ConfidenceScorer");

describe("hexagonal architecture boundaries", () => {
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
  });

  it("keeps technical decision components under engine layer", () => {
    expect(new IntradaySignalEngine()).toEqual(expect.any(IntradaySignalEngine));
    expect(new RiskManager()).toEqual(expect.any(RiskManager));
    expect(new ConfidenceScorer()).toEqual(expect.any(ConfidenceScorer));
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
