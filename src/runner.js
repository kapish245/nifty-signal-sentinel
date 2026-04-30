require("dotenv").config();

const KiteAuthAdapter = require("./adapters/zerodha/KiteAuthAdapter");
const ScannerController = require("./controllers/ScannerController");
const RuntimeService = require("./services/RuntimeService");

async function resolveAccessToken({ tokenPath, logger }) {
  return new RuntimeService({
    authAdapter: new KiteAuthAdapter(),
  }).resolveAccessToken({ tokenPath, logger });
}

function printSignals(signals) {
  for (const result of signals) {
    console.log(
      `[${result.signal_type}] ${result.symbol} | LTP=${result.ltp} | entry=${JSON.stringify(result.entry_zone)} `
        + `| SL=${result.stop_loss} | targets=${JSON.stringify(result.targets)} | confidence=${result.confidence_score}`,
    );
  }
}

async function createRuntime() {
  return new RuntimeService().createRuntime();
}

async function runOnce() {
  return new ScannerController({
    runtimeService: new RuntimeService(),
    printSignals,
  }).runOnce();
}

async function runScheduler() {
  return new ScannerController({
    runtimeService: new RuntimeService(),
    printSignals,
  }).runScheduler();
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
