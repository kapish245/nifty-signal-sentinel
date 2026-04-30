const fs = require("fs/promises");
const path = require("path");

function getDatePart(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getTimePart(date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

function formatTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "n/a";
  }

  return targets.join(" / ");
}

function formatEntryZone(entry_zone) {
  if (!entry_zone || typeof entry_zone !== "object") {
    return "n/a";
  }

  return `${entry_zone.min} - ${entry_zone.max}`;
}

function formatPercent(value) {
  if (value === null || value === undefined) return "n/a";
  return `${value}%`;
}

function formatPositionContext(position_context) {
  if (!position_context || position_context.has_position !== true) {
    return [
      "- Existing Position: No",
      `- Position Interpretation: ${position_context?.interpretation || "No existing position found"}`,
    ];
  }

  return [
    "- Existing Position: Yes",
    `- Quantity: ${position_context.quantity}`,
    `- Average Price: ${position_context.average_price}`,
    `- Position Value: ${position_context.position_value || "n/a"}`,
    `- Allocation: ${formatPercent(position_context.allocation_percent)}`,
    `- Unrealized P&L: ${position_context.unrealized_pnl || "n/a"}`,
    `- Delivery Fallback: ${position_context.delivery_fallback?.reason || "n/a"}`,
    `- Position Interpretation: ${position_context.interpretation || "n/a"}`,
  ];
}

function formatSignalMarkdown(signalPayload) {
  const {
    timestamp,
    symbol,
    ltp,
    indicators,
    reason,
    signal_type,
    signal,
    trade_action,
    entry_zone,
    stop_loss,
    targets,
    risk_reward,
    confidence_score,
    valid_until,
    setup_name,
    invalidation_reason,
    run_id,
    scan_id,
    symbol_analysis_id,
    signal_id,
    position_context,
  } = signalPayload;
  const indicatorPayload = indicators || {};
  const trend = indicatorPayload.emaAlignment || indicatorPayload.priceTrend || "unknown";
  const rsi = typeof indicatorPayload.rsi === "number" ? Number(indicatorPayload.rsi.toFixed(2)) : "n/a";
  const resolvedSignal = signal_type || signal || "NO_TRADE";

  return [
    `## ${getTimePart(timestamp)} - ${symbol} - ${resolvedSignal}`,
    "",
    `- Signal ID: ${signal_id || "n/a"}`,
    `- Run ID: ${run_id || "n/a"}`,
    `- Scan ID: ${scan_id || "n/a"}`,
    `- Symbol Analysis ID: ${symbol_analysis_id || "n/a"}`,
    "",
    "### Trade Plan",
    "",
    `- Action: ${trade_action || "NONE"}`,
    `- Price: ${typeof ltp === "number" ? ltp : "n/a"}`,
    `- Entry: ${formatEntryZone(entry_zone)}`,
    `- Stop Loss: ${typeof stop_loss === "number" ? stop_loss : "n/a"}`,
    `- Targets: ${formatTargets(targets)}`,
    `- Risk Reward: ${risk_reward || "n/a"}`,
    `- Confidence: ${typeof confidence_score === "number" ? `${confidence_score}%` : "n/a"}`,
    `- Valid Until: ${valid_until || "n/a"}`,
    "",
    "### Position Context",
    "",
    ...formatPositionContext(position_context),
    "",
    "### Evidence",
    "",
    `- Setup: ${setup_name || "n/a"}`,
    `- RSI: ${rsi}`,
    `- Trend: ${trend}`,
    `- Volume: ${indicatorPayload.volume || "n/a"}`,
    `- VWAP: ${typeof indicatorPayload.vwap === "number" ? indicatorPayload.vwap : "n/a"}`,
    `- ATR: ${typeof indicatorPayload.atr === "number" ? indicatorPayload.atr : "n/a"}`,
    `- MACD Bias: ${indicatorPayload.macd?.bias || "n/a"}`,
    `- Support: ${typeof indicatorPayload.support === "number" ? indicatorPayload.support : "n/a"}`,
    `- Resistance: ${typeof indicatorPayload.resistance === "number" ? indicatorPayload.resistance : "n/a"}`,
    `- Breakout: ${indicatorPayload.breakout?.type || "n/a"}`,
    `- Multi-Timeframe Bias: ${indicatorPayload.multiTimeframeBias || "n/a"}`,
    `- OI Signal: ${indicatorPayload.oiSignal || "n/a"}`,
    `- Derivatives Status: ${indicatorPayload.derivatives?.status || "n/a"}`,
    `- Derivatives Bias: ${indicatorPayload.derivatives?.derivativesBias || "n/a"}`,
    `- OI Confirmation: ${indicatorPayload.derivatives?.oiConfirmation || "n/a"}`,
    `- PCR: ${typeof indicatorPayload.derivatives?.pcr === "number" ? indicatorPayload.derivatives.pcr : "n/a"}`,
    `- Max Pain: ${indicatorPayload.derivatives?.maxPain || "n/a"}`,
    `- OI Support: ${indicatorPayload.derivatives?.oiSupport || "n/a"}`,
    `- OI Resistance: ${indicatorPayload.derivatives?.oiResistance || "n/a"}`,
    `- Reason: ${reason || "n/a"}`,
    `- Invalidation: ${invalidation_reason || "n/a"}`,
    "",
    "### Post-Market Review",
    "",
    "- Outcome: Pending",
    "- Mistake/Learning: Pending",
    "",
  ].join("\n");
}

function createObsidianLogger({
  logsRootDir = path.resolve(process.cwd(), "logs"),
  nowProvider = () => new Date(),
  isEnabled = process.env.ENABLE_OBSIDIAN_LOG !== "false",
} = {}) {
  return {
    async logSignal(signalPayload) {
      if (!isEnabled) {
        return null;
      }

      const timestamp = nowProvider();
      const datePart = getDatePart(timestamp);
      const obsidianDir = path.join(logsRootDir, "obsidian");
      const filePath = path.join(obsidianDir, `${datePart}.md`);
      const markdownBlock = formatSignalMarkdown({
        timestamp,
        ...signalPayload,
      });

      try {
        await fs.mkdir(obsidianDir, { recursive: true });
        await fs.appendFile(filePath, `${markdownBlock}\n`, "utf8");
      } catch (error) {
        console.error("Failed to write Obsidian log", {
          error: error.message,
          filePath,
        });
      }

      return {
        filePath,
        timestamp: timestamp.toISOString(),
      };
    },
  };
}

module.exports = {
  createObsidianLogger,
  formatSignalMarkdown,
};
