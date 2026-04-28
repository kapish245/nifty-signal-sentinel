const { nifty50 } = require("../config/nifty50");

const LOGGABLE_SIGNALS = new Set(["HOLD", "SELL"]);

function createDefaultLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
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

      for (const rawSymbol of symbols) {
        const symbol = `NSE:${String(rawSymbol).trim()}`;

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
        }
      }

      return {
        scannedCount: symbols.length,
        matches,
        failures,
      };
    },
  };
}

module.exports = {
  createScannerService,
  LOGGABLE_SIGNALS,
};
