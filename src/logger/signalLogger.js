const fs = require("fs/promises");
const path = require("path");

function formatDatePart(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function createSignalLogger({
  logsDir = path.resolve(process.cwd(), "logs"),
  nowProvider = () => new Date(),
} = {}) {
  return {
    async logSignal(signalPayload) {
      if (!signalPayload || typeof signalPayload !== "object") {
        throw new Error("signalPayload is required");
      }

      const now = nowProvider();
      const logDate = formatDatePart(now);
      const filePath = path.join(logsDir, `${logDate}.json`);
      const entry = {
        timestamp: now.toISOString(),
        symbol: signalPayload.symbol,
        signal: signalPayload.signal,
        ltp: signalPayload.ltp,
        indicators: signalPayload.indicators,
      };

      await fs.mkdir(logsDir, { recursive: true });

      let existingEntries = [];

      try {
        const fileContents = await fs.readFile(filePath, "utf8");
        existingEntries = JSON.parse(fileContents);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      if (!Array.isArray(existingEntries)) {
        throw new Error(`Signal log file is corrupted: ${filePath}`);
      }

      existingEntries.push(entry);
      await fs.writeFile(filePath, JSON.stringify(existingEntries, null, 2), "utf8");

      return entry;
    },
  };
}

module.exports = {
  createSignalLogger,
};
