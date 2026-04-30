const { MARKET_TIME_ZONE, MarketClock } = require("../market/MarketClock");

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;

function createDefaultLogger() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function isMarketOpen(date = new Date()) {
  return new MarketClock({ now_provider: () => date }).getMarketContext().is_market_open;
}

function startScheduler({
  scanMarket,
  intervalMs = DEFAULT_INTERVAL_MS,
  logger = createDefaultLogger(),
  nowProvider = () => new Date(),
} = {}) {
  if (typeof scanMarket !== "function") {
    throw new Error("scanMarket must be a function");
  }

  let isScanRunning = false;

  async function executeScan() {
    if (isScanRunning) {
      logger.warn({}, "Skipping scheduler tick because scan is still running");
      return;
    }

    if (!isMarketOpen(nowProvider())) {
      logger.info({ reason: "MARKET_CLOSED" }, "Skipping scheduler tick outside market hours");
      return;
    }

    isScanRunning = true;
    const startedAt = Date.now();
    logger.info({}, "Scheduler triggered market scan");

    try {
      const result = await scanMarket();
      logger.info(
        {
          scannedCount: result?.scannedCount ?? null,
          matchCount: result?.matches?.length ?? 0,
          failureCount: result?.failures?.length ?? 0,
          durationMs: Date.now() - startedAt,
        },
        "Completed scheduled market scan",
      );
    } catch (error) {
      logger.error({ error: error.message }, "Scheduled market scan failed");
    } finally {
      isScanRunning = false;
    }
  }

  const timerId = setInterval(() => {
    executeScan().catch((error) => {
      logger.error({ error: error.message }, "Unexpected scheduler execution failure");
    });
  }, intervalMs);

  executeScan().catch((error) => {
    logger.error({ error: error.message }, "Initial scheduler execution failed");
  });
  logger.info({ intervalMs }, "Scheduler started");

  return {
    stop() {
      clearInterval(timerId);
    },
  };
}

module.exports = {
  startScheduler,
  isMarketOpen,
  MARKET_TIME_ZONE,
  DEFAULT_INTERVAL_MS,
};
