const path = require("path");

const DiscordWebhookAdapter = require("../adapters/discord/DiscordWebhookAdapter");
const KiteAuthAdapter = require("../adapters/zerodha/KiteAuthAdapter");
const KiteDerivativesAdapter = require("../adapters/zerodha/KiteDerivativesAdapter");
const KiteHistoricalAdapter = require("../adapters/zerodha/KiteHistoricalAdapter");
const KiteQuoteAdapter = require("../adapters/zerodha/KiteQuoteAdapter");
const { createSignalAnalysisService } = require("./SignalAnalysisService");
const { createSignalLogger } = require("../logger/signalLogger");
const { createObsidianLogger } = require("../logger/obsidianLogger");
const { createLogger } = require("../logger/logger");
const { RunContext } = require("../logger/RunContext");
const { CandleRequirementService } = require("../market/CandleRequirementService");
const { MarketClock } = require("../market/MarketClock");
const { createScannerService } = require("./ScannerService");
const { createRateLimiter } = require("../utils/rateLimiter");

class RuntimeService {
  #env;

  #auth_adapter;

  constructor({ env = process.env, authAdapter = new KiteAuthAdapter() } = {}) {
    this.#env = env;
    this.#auth_adapter = authAdapter;
  }

  async createRuntime() {
    const logger = createLogger({ moduleName: "runtime" });
    const runContext = new RunContext();
    const accessToken = await this.resolveAccessToken({ logger });
    const quoteAdapter = this.#createQuoteAdapter({ logger, accessToken });
    const historicalAdapter = this.#createHistoricalAdapter({ logger, accessToken });
    const derivativesAdapter = this.#createDerivativesAdapter({ logger, accessToken });
    const signalService = this.#createSignalService({
      logger,
      runContext,
      quoteAdapter,
      historicalAdapter,
      derivativesAdapter,
    });
    const scannerService = this.#createScannerService({ logger, runContext, signalService });

    return {
      logger,
      runContext,
      scannerService,
    };
  }

  async resolveAccessToken({ tokenPath, logger }) {
    const resolved_token_path = tokenPath || this.#getTokenPath();
    const persistedToken = await this.#auth_adapter.loadPersistedToken({ tokenPath: resolved_token_path });
    const envAccessToken = typeof this.#env.ZERODHA_ACCESS_TOKEN === "string"
      ? this.#env.ZERODHA_ACCESS_TOKEN.trim()
      : "";

    return this.#resolveTokenValue({ persistedToken, envAccessToken, tokenPath: resolved_token_path, logger });
  }

  #resolveTokenValue({ persistedToken, envAccessToken, tokenPath, logger }) {
    if (persistedToken?.accessToken) {
      if (envAccessToken && envAccessToken !== persistedToken.accessToken) {
        logger?.warn({ tokenPath }, "Env access token differs from persisted token; using persisted token");
      } else {
        logger?.info({ tokenPath }, "Resolved access token from persisted token file");
      }
      return persistedToken.accessToken;
    }

    if (envAccessToken) {
      logger?.info({}, "Resolved access token from environment variable");
      return envAccessToken;
    }

    throw new Error("Access token not found. Set ZERODHA_ACCESS_TOKEN or persist a session file first.");
  }

  #getTokenPath() {
    return this.#env.ZERODHA_TOKEN_PATH || path.resolve(process.cwd(), "tmp", "kite-session.json");
  }

  #createQuoteAdapter({ logger, accessToken }) {
    return new KiteQuoteAdapter({
      apiKey: this.#env.ZERODHA_API_KEY,
      accessToken,
      logger: logger.child("adapters:zerodha:quote"),
      rateLimiter: createRateLimiter({ maxConcurrent: 1, minDelayMs: 1100 }),
    });
  }

  #createHistoricalAdapter({ logger, accessToken }) {
    return new KiteHistoricalAdapter({
      apiKey: this.#env.ZERODHA_API_KEY,
      accessToken,
      logger: logger.child("adapters:zerodha:historical"),
      rateLimiter: createRateLimiter({ maxConcurrent: 1, minDelayMs: 400 }),
    });
  }

  #createDerivativesAdapter({ logger, accessToken }) {
    return new KiteDerivativesAdapter({
      apiKey: this.#env.ZERODHA_API_KEY,
      accessToken,
      logger: logger.child("adapters:zerodha:derivatives"),
      rateLimiter: createRateLimiter({ maxConcurrent: 1, minDelayMs: 1100 }),
    });
  }

  #createSignalService({ logger, runContext, quoteAdapter, historicalAdapter, derivativesAdapter }) {
    return createSignalAnalysisService({
      kiteClient: quoteAdapter,
      historicalClient: historicalAdapter,
      derivativesProvider: derivativesAdapter,
      logger: logger.child("services:signal"),
      runContext,
      marketClock: new MarketClock(),
      candleRequirementService: new CandleRequirementService(),
      enforceMarketSignalMode: true,
    });
  }

  #createScannerService({ logger, runContext, signalService }) {
    return createScannerService({
      signalService,
      signalLogger: createSignalLogger(),
      obsidianLogger: createObsidianLogger({ isEnabled: this.#env.ENABLE_OBSIDIAN_LOG !== "false" }),
      discordNotifier: this.#createDiscordNotifier({ logger }),
      logger: logger.child("services:scanner"),
      runContext,
    });
  }

  #createDiscordNotifier({ logger }) {
    return new DiscordWebhookAdapter({
      webhookUrl: this.#env.DISCORD_WEBHOOK_URL,
      isEnabled: this.#env.ENABLE_DISCORD_ALERTS === "true",
      logger: logger.child("adapters:discord:webhook"),
    });
  }
}

module.exports = RuntimeService;
