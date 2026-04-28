const MARKET_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;

function createDefaultLogger() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function getIstDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value,
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
  };
}

function isMarketOpen(date = new Date()) {
  const { weekday, hour, minute } = getIstDateParts(date);

  if (["Sat", "Sun"].includes(weekday)) {
    return false;
  }

  const minutesSinceMidnight = hour * 60 + minute;

  return minutesSinceMidnight >= 9 * 60 + 15 && minutesSinceMidnight <= 15 * 60 + 30;
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
