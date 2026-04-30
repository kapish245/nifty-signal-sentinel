require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const KiteAuthAdapter = require("../adapters/zerodha/KiteAuthAdapter");
const KiteHistoricalAdapter = require("../adapters/zerodha/KiteHistoricalAdapter");
const RuntimeService = require("../services/RuntimeService");
const { BacktestService } = require("../services/BacktestService");
const { BacktestSignalLoader } = require("../services/BacktestSignalLoader");
const { HistoricalBacktestCandleProvider } = require("../services/HistoricalBacktestCandleProvider");
const { createLogger } = require("../logger/logger");
const { createRateLimiter } = require("../utils/rateLimiter");

function parseArgs(argv) {
  return argv.reduce((args, arg) => {
    if (!arg.startsWith("--")) return args;

    const [key, value = "true"] = arg.slice(2).split("=");
    return { ...args, [key]: value };
  }, {});
}

function getRequiredDate(args) {
  if (args.date) return args.date;
  throw new Error("Backtest date is required. Usage: npm run backtest:signals -- --date=YYYY-MM-DD");
}

function printReport(report) {
  console.log(JSON.stringify({
    date: report.date,
    source: report.source,
    report_path: report.report_path,
    metrics: report.metrics,
  }, null, 2));
}

async function saveReport({ date, report, logsDir }) {
  const output_dir = path.join(logsDir, "backtests");
  const report_path = path.join(output_dir, `${date}.json`);

  await fs.mkdir(output_dir, { recursive: true });
  await fs.writeFile(report_path, JSON.stringify(report, null, 2), "utf8");

  return report_path;
}

async function createHistoricalClient({ logger }) {
  const runtime_service = new RuntimeService({ authAdapter: new KiteAuthAdapter() });
  const accessToken = await runtime_service.resolveAccessToken({ logger });

  return new KiteHistoricalAdapter({
    apiKey: process.env.ZERODHA_API_KEY,
    accessToken,
    logger: logger.child("adapters:zerodha:historical_backtest"),
    rateLimiter: createRateLimiter({ maxConcurrent: 1, minDelayMs: 400 }),
  });
}

async function runBacktest(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const date = getRequiredDate(args);
  const logsDir = path.resolve(process.cwd(), args.logsDir || "logs");
  const logger = createLogger({ moduleName: "backtest" });
  const signal_loader = new BacktestSignalLoader({ logsDir });
  const signals = await signal_loader.loadSignals({ date, source: args.source || "auto" });
  const historical_client = await createHistoricalClient({ logger });
  const candle_provider = new HistoricalBacktestCandleProvider({
    historicalClient: historical_client,
    interval: args.interval || "minute",
    lookbackMinutes: Number(args.lookbackMinutes) || 2 * 24 * 60,
  });
  const backtest_service = new BacktestService({ candleProvider: candle_provider });
  const report = await backtest_service.run({ signals });
  const source = signals[0]?.source || args.source || "unknown";
  const report_path = await saveReport({ date, report, logsDir });

  return {
    ...report,
    date,
    source,
    report_path,
  };
}

if (require.main === module) {
  runBacktest()
    .then(printReport)
    .catch((error) => {
      console.error(JSON.stringify({
        level: "error",
        message: "Backtest failed",
        error: error.message,
      }));
      process.exitCode = 1;
    });
}

module.exports = {
  parseArgs,
  runBacktest,
};
