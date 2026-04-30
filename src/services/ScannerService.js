const { nifty50 } = require("../config/nifty50");
const { RunContext } = require("../logger/RunContext");
const { ACTIONABLE_SIGNAL_TYPES } = require("../engines/technical/SignalTypes");

const LOGGABLE_SIGNALS = ACTIONABLE_SIGNAL_TYPES;
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
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function isFatalScanError(error) {
  const message = error?.message || "";

  return FATAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

class ScannerService {
  #signal_service;

  #symbols;

  #logger;

  #signal_logger;

  #obsidian_logger;

  #discord_notifier;

  #run_context;

  constructor({
    signalService,
    symbols = nifty50,
    logger = createDefaultLogger(),
    signalLogger,
    obsidianLogger,
    discordNotifier,
    runContext = new RunContext(),
  } = {}) {
    if (!signalService || typeof signalService.getSignal !== "function") {
      throw new Error("signalService with getSignal(symbol) is required");
    }
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new Error("symbols must be a non-empty array");
    }

    this.#signal_service = signalService;
    this.#symbols = symbols;
    this.#logger = logger;
    this.#signal_logger = signalLogger;
    this.#obsidian_logger = obsidianLogger;
    this.#discord_notifier = discordNotifier;
    this.#run_context = runContext;
  }

  async scanMarket() {
    const scan_context = this.#run_context.createScanContext();
    const result = this.#createEmptyScanResult(scan_context);
    const scan_started_at = Date.now();

    this.#logger.info({ ...scan_context, requestedCount: this.#symbols.length }, "Market scan started");
    await this.#scanSymbols({ result, scan_context });
    result.durationMs = Date.now() - scan_started_at;
    this.#logScanCompleted({ result, scan_context });

    return result;
  }

  #createEmptyScanResult(scan_context) {
    return {
      ...scan_context,
      scannedCount: 0,
      requestedCount: this.#symbols.length,
      matches: [],
      failures: [],
      aborted: false,
      durationMs: 0,
    };
  }

  async #scanSymbols({ result, scan_context }) {
    for (const raw_symbol of this.#symbols) {
      const symbol = `NSE:${String(raw_symbol).trim()}`;
      const symbol_context = this.#run_context.createSymbolAnalysisContext({
        scan_id: scan_context.scan_id,
        symbol,
      });

      result.scannedCount += 1;
      if (await this.#processSymbol({ symbol, symbol_context, result })) break;
    }
  }

  async #processSymbol({ symbol, symbol_context, result }) {
    this.#logSymbolProcessing({ symbol, symbol_context, result });

    try {
      const signal_result = await this.#signal_service.getSignal(symbol, symbol_context);
      await this.#handleSignalResult({ signal_result, symbol_context, result });
      return false;
    } catch (error) {
      return this.#handleSymbolFailure({ symbol, symbol_context, error, result });
    }
  }

  #logSymbolProcessing({ symbol, symbol_context, result }) {
    this.#logger.debug(
      { ...symbol_context, symbol, position: result.scannedCount, requestedCount: this.#symbols.length },
      "Processing symbol",
    );
  }

  async #handleSignalResult({ signal_result, symbol_context, result }) {
    if (!LOGGABLE_SIGNALS.has(signal_result.signal_type || signal_result.signal)) return;

    result.matches.push(signal_result);
    await this.#persistSignal(signal_result, symbol_context);
    this.#logger.info(this.#buildSignalLog(signal_result, symbol_context), "Meaningful trading signal detected");
  }

  async #persistSignal(signal_result, symbol_context) {
    await this.#persistWithLogger({
      logger: this.#signal_logger,
      signal_result,
      symbol_context,
      failure_message: "Failed to persist trading signal",
    });
    await this.#persistWithLogger({
      logger: this.#obsidian_logger,
      signal_result,
      symbol_context,
      failure_message: "Failed to persist Obsidian trading signal",
    });
    await this.#persistWithLogger({
      logger: this.#discord_notifier,
      signal_result,
      symbol_context,
      failure_message: "Failed to send Discord trading signal",
    });
  }

  async #persistWithLogger({ logger, signal_result, symbol_context, failure_message }) {
    if (!logger?.logSignal) return;

    try {
      await logger.logSignal(signal_result);
    } catch (error) {
      this.#logger.error({ ...symbol_context, symbol: signal_result.symbol, error: error.message }, failure_message);
    }
  }

  #buildSignalLog(signal_result, symbol_context) {
    return {
      ...symbol_context,
      signal_id: signal_result.signal_id || null,
      symbol: signal_result.symbol,
      signal_type: signal_result.signal_type,
      ltp: signal_result.ltp,
      entry_zone: signal_result.entry_zone,
      stop_loss: signal_result.stop_loss,
      targets: signal_result.targets,
      confidence_score: signal_result.confidence_score,
      reason: signal_result.reason || null,
    };
  }

  #handleSymbolFailure({ symbol, symbol_context, error, result }) {
    const failure = { ...symbol_context, symbol, error: error.message };

    result.failures.push(failure);
    this.#logger.error(failure, "Market scan failed for symbol");
    if (!isFatalScanError(error)) return false;

    result.aborted = true;
    this.#logger.error(failure, "Aborting market scan because the failure is fatal");
    return true;
  }

  #logScanCompleted({ result, scan_context }) {
    this.#logger.info(
      {
        ...scan_context,
        scannedCount: result.scannedCount,
        requestedCount: result.requestedCount,
        matchCount: result.matches.length,
        failureCount: result.failures.length,
        aborted: result.aborted,
        durationMs: result.durationMs,
      },
      "Market scan completed",
    );
  }
}

function createScannerService(config) {
  return new ScannerService(config);
}

module.exports = {
  ScannerService,
  createScannerService,
  LOGGABLE_SIGNALS,
  isFatalScanError,
};
