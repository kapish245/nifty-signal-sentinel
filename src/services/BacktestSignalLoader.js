const fs = require("fs/promises");
const path = require("path");

function toNumber(value) {
  const normalized_value = String(value || "").replace("%", "").trim();
  const numeric_value = Number(normalized_value);
  return Number.isFinite(numeric_value) ? numeric_value : null;
}

function parseEntryZone(value) {
  const [min, max] = String(value || "").split(" - ").map(toNumber);
  return { min, max };
}

function parseTargets(value) {
  return String(value || "")
    .split(" / ")
    .map(toNumber)
    .filter((target) => target !== null);
}

function parseBulletValue(block, label) {
  const regex = new RegExp(`^- ${label}: (.+)$`, "m");
  return block.match(regex)?.[1]?.trim() || null;
}

function parseHeader(header) {
  const match = header.match(/^##\s+(.+?)\s+-\s+(NSE:[^\s]+)\s+-\s+([A-Z_]+)/);
  if (!match) return null;

  return {
    local_time: match[1],
    symbol: match[2],
    signal_type: match[3],
  };
}

function inferTimestamp(valid_until) {
  const valid_until_date = new Date(valid_until);
  if (Number.isNaN(valid_until_date.getTime())) return null;

  return new Date(valid_until_date.getTime() - 30 * 60 * 1000).toISOString();
}

function parseObsidianSignals(markdown) {
  const sections = String(markdown || "")
    .split(/\n(?=##\s+)/)
    .filter((section) => section.trim().startsWith("## "));

  return sections.map(parseObsidianSignal).filter(Boolean);
}

function parseObsidianSignal(section) {
  const [header] = section.split("\n");
  const parsed_header = parseHeader(header);
  if (!parsed_header) return null;

  const valid_until = parseBulletValue(section, "Valid Until");

  return {
    timestamp: inferTimestamp(valid_until),
    signal_id: parseBulletValue(section, "Signal ID"),
    run_id: parseBulletValue(section, "Run ID"),
    scan_id: parseBulletValue(section, "Scan ID"),
    symbol_analysis_id: parseBulletValue(section, "Symbol Analysis ID"),
    symbol: parsed_header.symbol,
    signal_type: parsed_header.signal_type,
    trade_action: parseBulletValue(section, "Action"),
    ltp: toNumber(parseBulletValue(section, "Price")),
    entry_zone: parseEntryZone(parseBulletValue(section, "Entry")),
    stop_loss: toNumber(parseBulletValue(section, "Stop Loss")),
    targets: parseTargets(parseBulletValue(section, "Targets")),
    risk_reward: toNumber(parseBulletValue(section, "Risk Reward")),
    confidence_score: toNumber(parseBulletValue(section, "Confidence")),
    valid_until,
    setup_name: parseBulletValue(section, "Setup"),
    reason: parseBulletValue(section, "Reason"),
    invalidation_reason: parseBulletValue(section, "Invalidation"),
    source: "obsidian_markdown",
  };
}

class BacktestSignalLoader {
  #logs_dir;

  constructor({ logsDir = path.resolve(process.cwd(), "logs") } = {}) {
    this.#logs_dir = logsDir;
  }

  async loadSignals({ date, source = "auto" }) {
    if (source === "json" || source === "auto") {
      const json_signals = await this.#loadJsonSignals(date);
      if (json_signals) return json_signals;
    }

    return this.#loadObsidianSignals(date);
  }

  async #loadJsonSignals(date) {
    const file_path = path.join(this.#logs_dir, `${date}.json`);

    try {
      const contents = await fs.readFile(file_path, "utf8");
      const payload = JSON.parse(contents);
      return Array.isArray(payload)
        ? payload.map((signal) => ({ ...signal, source: "structured_json" }))
        : [];
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async #loadObsidianSignals(date) {
    const file_path = path.join(this.#logs_dir, "obsidian", `${date}.md`);
    const contents = await fs.readFile(file_path, "utf8");
    return parseObsidianSignals(contents);
  }
}

module.exports = {
  BacktestSignalLoader,
  parseObsidianSignals,
};
