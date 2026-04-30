const { startScheduler } = require("../scheduler/scheduler");

class ScannerController {
  #runtime_service;

  #print_signals;

  constructor({ runtimeService, printSignals }) {
    if (!runtimeService || typeof runtimeService.createRuntime !== "function") {
      throw new Error("runtimeService with createRuntime() is required");
    }

    this.#runtime_service = runtimeService;
    this.#print_signals = printSignals || (() => undefined);
  }

  async runOnce() {
    const { scannerService } = await this.#runtime_service.createRuntime();
    const result = await scannerService.scanMarket();
    this.#print_signals(result.matches);

    return result;
  }

  async runScheduler() {
    const { logger, runContext, scannerService } = await this.#runtime_service.createRuntime();
    const schedulerLogger = logger.child("scheduler");
    const intervalMs = Number(process.env.SCANNER_INTERVAL_MS) || 2 * 60 * 1000;

    schedulerLogger.info(
      { run_id: runContext.getRunId(), intervalMs },
      "Starting market scanner scheduler",
    );
    startScheduler({
      intervalMs,
      logger: schedulerLogger,
      scanMarket: async () => {
        const result = await scannerService.scanMarket();
        this.#print_signals(result.matches);
        return result;
      },
    });
  }
}

module.exports = ScannerController;
