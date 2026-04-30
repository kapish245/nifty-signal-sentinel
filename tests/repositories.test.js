const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const { CandleRepository } = require("../src/repositories/CandleRepository");
const MarketContextRepository = require("../src/repositories/MarketContextRepository");
const WatchlistRepository = require("../src/repositories/WatchlistRepository");

describe("file repositories", () => {
  let rootDir;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "nss-data-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("persists candles under symbol and interval folders", async () => {
    const repository = new CandleRepository({ root_dir: rootDir });
    const candles = [{ timestamp: "2026-04-30T09:15:00+05:30", close: 100 }];

    await repository.saveCandles({
      symbol: "NSE:INFY",
      interval: "5minute",
      date: "2026-04-30",
      candles,
    });

    const result = await repository.loadCandles({
      symbol: "NSE:INFY",
      interval: "5minute",
      date: "2026-04-30",
    });

    expect(result).toMatchObject({
      symbol: "NSE:INFY",
      interval: "5minute",
      date: "2026-04-30",
      candles,
    });
  });

  it("persists market context and watchlist files", async () => {
    const marketContextRepository = new MarketContextRepository({ root_dir: rootDir });
    const watchlistRepository = new WatchlistRepository({ root_dir: rootDir });

    await marketContextRepository.saveMarketContext({
      date: "2026-04-30",
      context: { mode: "PRE_MARKET" },
    });
    await watchlistRepository.saveWatchlist({
      date: "2026-04-30",
      candidates: [{ symbol: "NSE:INFY", bias: "BULLISH" }],
    });

    await expect(marketContextRepository.loadMarketContext("2026-04-30")).resolves.toMatchObject({
      context: { mode: "PRE_MARKET" },
    });
    await expect(watchlistRepository.loadWatchlist("2026-04-30")).resolves.toMatchObject({
      candidates: [{ symbol: "NSE:INFY", bias: "BULLISH" }],
    });
  });
});
