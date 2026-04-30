const axios = require("axios");

const { DiscordSignalFormatter } = require("../../notifications/DiscordSignalFormatter");

const DEFAULT_TIMEOUT_MS = 10000;

function createDefaultLogger() {
  return {
    warn: () => undefined,
    error: () => undefined,
  };
}

class DiscordWebhookAdapter {
  #webhook_url;

  #http_client;

  #formatter;

  #is_enabled;

  #logger;

  #username;

  #timeout_ms;

  constructor({
    webhookUrl,
    httpClient = axios,
    formatter = new DiscordSignalFormatter(),
    isEnabled = true,
    logger = createDefaultLogger(),
    username = "Nifty Signal Sentinel",
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.#webhook_url = typeof webhookUrl === "string" ? webhookUrl.trim() : "";
    this.#http_client = httpClient;
    this.#formatter = formatter;
    this.#is_enabled = isEnabled;
    this.#logger = logger;
    this.#username = username;
    this.#timeout_ms = timeoutMs;
  }

  async logSignal(signalPayload) {
    if (!this.#is_enabled) {
      return { status: "skipped", reason: "DISCORD_ALERTS_DISABLED" };
    }

    if (!this.#webhook_url) {
      this.#logger.warn({}, "Discord webhook URL missing; skipping alert");
      return { status: "skipped", reason: "DISCORD_WEBHOOK_URL_MISSING" };
    }

    const content = this.#formatter.format(signalPayload);
    await this.#http_client.post(
      this.#webhook_url,
      {
        username: this.#username,
        content,
        allowed_mentions: { parse: [] },
      },
      { timeout: this.#timeout_ms },
    );

    return { status: "sent" };
  }
}

module.exports = DiscordWebhookAdapter;
