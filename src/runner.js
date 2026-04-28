require("dotenv").config();

const path = require("path");

const { loadPersistedToken } = require("./auth/token");
const { createKiteClient } = require("./data/kiteClient");
const { createHistoricalDataClient } = require("./data/kiteHistorical");
const { createSignalService } = require("./services/signalService");
const { createSignalLogger } = require("./logger/signalLogger");
const { createScannerService } = require("./scanner/scannerService");
const { startScheduler } = require("./scheduler/scheduler");
const { createRateLimiter } = require("./utils/rateLimiter");

function createLogger(baseLogger = console) {
  return {
    info: (payload, message) => baseLogger.log(JSON.stringify({
      level: "info",
      message,
      ...payload,
    })),
    warn: (payload, message) => baseLogger.warn(JSON.stringify({
      level: "warn",
      message,
      ...payload,
    })),
    error: (payload, message) => baseLogger.error(JSON.stringify({
      level: "error",
      message,
      ...payload,
    })),
  };
}

async function resolveAccessToken({ tokenPath }) {
  if (process.env.ZERODHA_ACCESS_TOKEN) {
    return process.env.ZERODHA_ACCESS_TOKEN;
  }

  const persistedToken = await loadPersistedToken({ tokenPath });

  if (!persistedToken?.accessToken) {
    throw new Error(
      "Access token not found. Set ZERODHA_ACCESS_TOKEN or persist a session file first.",
    );
  }

  return persistedToken.accessToken;
}

function printSignals(signals) {
  for (const result of signals) {
    console.log(
      `[${result.signal}] ${result.symbol} | LTP=${result.ltp} | indicators=${JSON.stringify(result.indicators)}`,
    );
  }
}

async function createRuntime() {
  const logger = createLogger();
  const tokenPath =
    process.env.ZERODHA_TOKEN_PATH ||
    path.resolve(process.cwd(), "tmp", "kite-session.json");
  const accessToken = await resolveAccessToken({ tokenPath });
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
    logger,
    rateLimiter: quoteRateLimiter,
  });
  const historicalClient = createHistoricalDataClient({
    apiKey: process.env.ZERODHA_API_KEY,
    accessToken,
    logger,
    rateLimiter: historicalRateLimiter,
  });
  const signalService = createSignalService({
    kiteClient,
    historicalClient,
    logger,
  });
  const signalLogger = createSignalLogger();
  const scannerService = createScannerService({
    signalService,
    signalLogger,
    logger,
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
  const intervalMs = Number(process.env.SCANNER_INTERVAL_MS) || 2 * 60 * 1000;

  logger.info({ intervalMs }, "Starting market scanner scheduler");

  startScheduler({
    intervalMs,
    logger,
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
  createLogger,
  createRuntime,
  printSignals,
  runOnce,
  runScheduler,
  resolveAccessToken,
};
