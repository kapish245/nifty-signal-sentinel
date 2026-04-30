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
        run_id: signalPayload.run_id,
        scan_id: signalPayload.scan_id,
        symbol_analysis_id: signalPayload.symbol_analysis_id,
        signal_id: signalPayload.signal_id,
        symbol: signalPayload.symbol,
        signal_type: signalPayload.signal_type || signalPayload.signal,
        trade_action: signalPayload.trade_action,
        ltp: signalPayload.ltp,
        entry_zone: signalPayload.entry_zone,
        stop_loss: signalPayload.stop_loss,
        targets: signalPayload.targets,
        risk_reward: signalPayload.risk_reward,
        confidence_score: signalPayload.confidence_score,
        valid_until: signalPayload.valid_until,
        setup_name: signalPayload.setup_name,
        reason: signalPayload.reason,
        invalidation_reason: signalPayload.invalidation_reason,
        position_context: signalPayload.position_context,
        evidence: signalPayload.evidence,
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
