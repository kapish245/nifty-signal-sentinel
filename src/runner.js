require("dotenv").config();

const path = require("path");

const { loadPersistedToken } = require("./auth/token");
const { createKiteClient } = require("./data/kiteClient");
const { createHistoricalDataClient } = require("./data/kiteHistorical");
const { createSignalService } = require("./services/signalService");
const { createSignalLogger } = require("./logger/signalLogger");
const { createObsidianLogger } = require("./logger/obsidianLogger");
const { createLogger } = require("./logger/logger");
const { createScannerService } = require("./scanner/scannerService");
const { startScheduler } = require("./scheduler/scheduler");
const { createRateLimiter } = require("./utils/rateLimiter");

async function resolveAccessToken({ tokenPath, logger }) {
  const persistedToken = await loadPersistedToken({ tokenPath });
  const envAccessToken = typeof process.env.ZERODHA_ACCESS_TOKEN === "string"
    ? process.env.ZERODHA_ACCESS_TOKEN.trim()
    : "";

  if (persistedToken?.accessToken) {
    if (envAccessToken && envAccessToken !== persistedToken.accessToken) {
      logger?.warn(
        { tokenPath },
        "Env access token differs from persisted token; using persisted token",
      );
    } else {
      logger?.info({ tokenPath }, "Resolved access token from persisted token file");
    }
    return persistedToken.accessToken;
  }

  if (envAccessToken) {
    logger?.info({}, "Resolved access token from environment variable");
    return envAccessToken;
  }

  throw new Error(
    "Access token not found. Set ZERODHA_ACCESS_TOKEN or persist a session file first.",
  );
}

function printSignals(signals) {
  for (const result of signals) {
    console.log(
      `[${result.signal}] ${result.symbol} | LTP=${result.ltp} | indicators=${JSON.stringify(result.indicators)}`,
    );
  }
}

async function createRuntime() {
  const logger = createLogger({ moduleName: "runtime" });
  const signalServiceLogger = logger.child("services:signal");
  const scannerLogger = logger.child("scanner:service");
  const tokenPath =
    process.env.ZERODHA_TOKEN_PATH ||
    path.resolve(process.cwd(), "tmp", "kite-session.json");
  const accessToken = await resolveAccessToken({ tokenPath, logger });
  const quoteRateLimiter = createRateLimiter({
    maxConcurrent: 1,
    minDelayMs: 1100,
  });
  const historicalRateLimiter = createRateLimiter({
    maxConcurrent: 1,
    minDelayMs: 400,
  });
  const kiteClient = createKiteClient({
    apiKey: process.env.ZERODHA_API_KEY,
    accessToken,
    logger: logger.child("data:kiteClient"),
    rateLimiter: quoteRateLimiter,
  });
  const historicalClient = createHistoricalDataClient({
    apiKey: process.env.ZERODHA_API_KEY,
    accessToken,
    logger: logger.child("data:kiteHistorical"),
    rateLimiter: historicalRateLimiter,
  });
  const signalService = createSignalService({
    kiteClient,
    historicalClient,
    logger: signalServiceLogger,
  });
  const signalLogger = createSignalLogger();
  const obsidianLogger = createObsidianLogger({
    isEnabled: process.env.ENABLE_OBSIDIAN_LOG !== "false",
  });
  const scannerService = createScannerService({
    signalService,
    signalLogger,
    obsidianLogger,
    logger: scannerLogger,
  });

  return {
    logger,
    scannerService,
  };
}

async function runOnce() {
  const { scannerService } = await createRuntime();
  const result = await scannerService.scanMarket();
  printSignals(result.matches);
  return result;
}

async function runScheduler() {
  const { logger, scannerService } = await createRuntime();
  const schedulerLogger = logger.child("scheduler");
  const intervalMs = Number(process.env.SCANNER_INTERVAL_MS) || 2 * 60 * 1000;

  schedulerLogger.info({ intervalMs }, "Starting market scanner scheduler");

  startScheduler({
    intervalMs,
    logger: schedulerLogger,
    scanMarket: async () => {
      const result = await scannerService.scanMarket();
      printSignals(result.matches);
      return result;
    },
  });
}

if (require.main === module) {
  const runMode = process.argv.includes("--once") ? runOnce : runScheduler;

  runMode().catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Trading runner failed",
        error: error.message,
      }),
    );
    process.exitCode = 1;
  });
}

module.exports = {
  createRuntime,
  printSignals,
  runOnce,
  runScheduler,
  resolveAccessToken,
};
