const { PortfolioRepository } = require("../src/repositories/PortfolioRepository");
const {
  PortfolioContextService,
  normalizeSymbol,
} = require("../src/services/PortfolioContextService");

describe("PortfolioContextService", () => {
  it("normalizes NSE symbols consistently", () => {
    expect(normalizeSymbol("NSE:kaynes")).toBe("KAYNES");
    expect(normalizeSymbol(" infy ")).toBe("INFY");
  });

  it("merges Nifty/base symbols with local holdings and watchlist symbols", async () => {
    const portfolioRepository = {
      loadPortfolio: jest.fn().mockResolvedValue({
        capital: 100000,
        holdings: [{ symbol: "KAYNES", quantity: 10, average_price: 4200 }],
        watchlist: [{ symbol: "CDSL" }, { symbol: "INFY" }],
      }),
    };
    const service = new PortfolioContextService({ portfolioRepository });

    const scan_context = await service.prepareScan({ baseSymbols: ["INFY", "TCS"] });

    expect(scan_context.symbols).toEqual(["INFY", "TCS", "KAYNES", "CDSL"]);
  });

  it("calculates existing holding context from local portfolio data", async () => {
    const portfolioRepository = {
      loadPortfolio: jest.fn().mockResolvedValue({
        capital: 100000,
        holdings: [{ symbol: "KAYNES", quantity: 10, average_price: 4200 }],
        watchlist: [],
      }),
    };
    const service = new PortfolioContextService({ portfolioRepository });
    const scan_context = await service.prepareScan({ baseSymbols: ["INFY"] });

    const position_context = service.getPositionContext({
      symbol: "NSE:KAYNES",
      ltp: 4500,
      portfolioScanContext: scan_context,
    });

    expect(position_context).toMatchObject({
      has_position: true,
      quantity: 10,
      average_price: 4200,
      position_value: 45000,
      allocation_percent: 45,
      unrealized_pnl: 3000,
      unrealized_pnl_percent: 7.14,
      delivery_fallback: {
        is_allowed: true,
      },
    });
  });

  it("returns an empty portfolio when the local JSON file is missing", async () => {
    const repository = new PortfolioRepository({ filePath: "/tmp/nifty-signal-missing-portfolio.json" });

    await expect(repository.loadPortfolio()).resolves.toEqual({
      capital: null,
      holdings: [],
      watchlist: [],
    });
  });
});
