const DiscordWebhookAdapter = require("../src/adapters/discord/DiscordWebhookAdapter");
const { formatDiscordSignal } = require("../src/notifications/DiscordSignalFormatter");

function buildSignalPayload() {
  return {
    run_id: "run_1",
    scan_id: "scan_1",
    symbol_analysis_id: "symbol_1",
    signal_id: "signal_1",
    symbol: "NSE:INFY",
    signal_type: "INTRADAY_LONG",
    trade_action: "BUY",
    ltp: 1500,
    entry_zone: { min: 1497, max: 1503 },
    stop_loss: 1488,
    targets: [1515, 1524],
    risk_reward: 1.5,
    confidence_score: 77,
    valid_until: "2026-04-30T05:30:00.000Z",
    reason: "Bullish continuation",
    invalidation_reason: "Exit near stop loss 1488.",
    evidence: {
      rsi: 61,
      ema_alignment: "bullish",
      breakout: "bullish_breakout",
      multi_timeframe_bias: "bullish",
      derivatives_status: "available",
      derivatives_bias: "bullish",
      oi_confirmation: "confirms",
      pcr: 1.2,
      max_pain: 1500,
      oi_support: 1480,
      oi_resistance: 1520,
    },
  };
}

describe("DiscordSignalFormatter", () => {
  it("formats deterministic Discord signal content", () => {
    const content = formatDiscordSignal(buildSignalPayload());

    expect(content).toContain("**INTRADAY_LONG NSE:INFY**");
    expect(content).toContain("Entry: 1497 - 1503");
    expect(content).toContain("Stop Loss: 1488");
    expect(content).toContain("Confidence: 77%");
    expect(content).toContain("Derivatives: status available, bias bullish, confirmation confirms");
    expect(content).toContain("Signal: signal_1");
  });
});

describe("DiscordWebhookAdapter", () => {
  it("posts formatted signal content to Discord webhook", async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({ status: 204 }),
    };
    const adapter = new DiscordWebhookAdapter({
      webhookUrl: "https://discord.test/webhook",
      httpClient,
    });

    const result = await adapter.logSignal(buildSignalPayload());

    expect(result).toEqual({ status: "sent" });
    expect(httpClient.post).toHaveBeenCalledWith(
      "https://discord.test/webhook",
      expect.objectContaining({
        username: "Nifty Signal Sentinel",
        content: expect.stringContaining("INTRADAY_LONG NSE:INFY"),
        allowed_mentions: { parse: [] },
      }),
      { timeout: 10000 },
    );
  });

  it("skips sending when alerts are disabled", async () => {
    const httpClient = {
      post: jest.fn(),
    };
    const adapter = new DiscordWebhookAdapter({
      webhookUrl: "https://discord.test/webhook",
      httpClient,
      isEnabled: false,
    });

    const result = await adapter.logSignal(buildSignalPayload());

    expect(result).toEqual({ status: "skipped", reason: "DISCORD_ALERTS_DISABLED" });
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("warns and skips when webhook URL is missing", async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    const httpClient = {
      post: jest.fn(),
    };
    const adapter = new DiscordWebhookAdapter({
      httpClient,
      logger,
    });

    const result = await adapter.logSignal(buildSignalPayload());

    expect(result).toEqual({ status: "skipped", reason: "DISCORD_WEBHOOK_URL_MISSING" });
    expect(logger.warn).toHaveBeenCalledWith({}, "Discord webhook URL missing; skipping alert");
    expect(httpClient.post).not.toHaveBeenCalled();
  });
});
