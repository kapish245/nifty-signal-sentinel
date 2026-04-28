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

function formatSignalMarkdown({ timestamp, symbol, ltp, signal, indicators, reason }) {
  const indicatorPayload = indicators || {};
  const trend = indicatorPayload.emaAlignment || indicatorPayload.priceTrend || "unknown";
  const rsi = typeof indicatorPayload.rsi === "number" ? Number(indicatorPayload.rsi.toFixed(2)) : "n/a";

  return [
    `## Time: ${getTimePart(timestamp)}`,
    "",
    `### Symbol: ${symbol}`,
    "",
    `* Signal: ${signal || "NO_TRADE"}`,
    `* Price: ${typeof ltp === "number" ? ltp : "n/a"}`,
    `* RSI: ${rsi}`,
    `* Trend: ${trend}`,
    `* Reason: ${reason || "n/a"}`,
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
