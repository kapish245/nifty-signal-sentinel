const { nifty50 } = require("../config/nifty50");

const LOGGABLE_SIGNALS = new Set(["HOLD", "SELL"]);
const FATAL_ERROR_PATTERNS = [
  /invalid session/i,
  /token is required/i,
  /api key is required/i,
  /access token not found/i,
  /failed to fetch ltp: invalid session/i,
  /failed to fetch historical candles: invalid session/i,
];

function createDefaultLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function isFatalScanError(error) {
  const message = error?.message || "";

  return FATAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function createScannerService({
  signalService,
  symbols = nifty50,
  logger = createDefaultLogger(),
  signalLogger,
} = {}) {
  if (!signalService || typeof signalService.getSignal !== "function") {
    throw new Error("signalService with getSignal(symbol) is required");
  }

  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error("symbols must be a non-empty array");
  }

  return {
    async scanMarket() {
      const matches = [];
      const failures = [];
      let aborted = false;
      let scannedCount = 0;

      for (const rawSymbol of symbols) {
        const symbol = `NSE:${String(rawSymbol).trim()}`;
        scannedCount += 1;

        try {
          const result = await signalService.getSignal(symbol);

          if (!LOGGABLE_SIGNALS.has(result.signal)) {
            continue;
          }

          matches.push(result);

          if (signalLogger?.logSignal) {
            try {
              await signalLogger.logSignal(result);
            } catch (error) {
              logger.error(
                {
                  symbol: result.symbol,
                  error: error.message,
                },
                "Failed to persist trading signal",
              );
            }
          }

          logger.info(
            {
              symbol: result.symbol,
              signal: result.signal,
              ltp: result.ltp,
            },
            "Meaningful trading signal detected",
          );
        } catch (error) {
          const failure = {
            symbol,
            error: error.message,
          };
          failures.push(failure);
          logger.error(failure, "Market scan failed for symbol");

          if (isFatalScanError(error)) {
            aborted = true;
            logger.error(
              {
                symbol,
                error: error.message,
              },
              "Aborting market scan because the failure is fatal",
            );
            break;
          }
        }
      }

      return {
        scannedCount,
        requestedCount: symbols.length,
        matches,
        failures,
        aborted,
      };
    },
  };
}

module.exports = {
  createScannerService,
  LOGGABLE_SIGNALS,
  isFatalScanError,
};
