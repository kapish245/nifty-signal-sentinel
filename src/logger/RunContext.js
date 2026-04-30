const { randomUUID } = require("crypto");

function getTimestampPart(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function normalizeIdPart(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createId({ prefix, now_provider, id_provider, parts = [] }) {
  const timestamp_part = getTimestampPart(now_provider());
  const random_part = id_provider().replace(/-/g, "").slice(0, 8);
  const normalized_parts = parts.map(normalizeIdPart).filter(Boolean);

  return [prefix, timestamp_part, ...normalized_parts, random_part].join("_");
}

class RunContext {
  #run_id;

  #now_provider;

  #id_provider;

  constructor({ run_id, now_provider = () => new Date(), id_provider = randomUUID } = {}) {
    this.#now_provider = now_provider;
    this.#id_provider = id_provider;
    this.#run_id = run_id || this.#createId("run");
  }

  getRunId() {
    return this.#run_id;
  }

  createScanContext() {
    return {
      run_id: this.#run_id,
      scan_id: this.#createId("scan"),
    };
  }

  createSymbolAnalysisContext({ scan_id, symbol }) {
    return {
      run_id: this.#run_id,
      scan_id,
      symbol_analysis_id: this.#createId("symbol", [symbol]),
    };
  }

  createSignalId({ symbol, signal_type }) {
    return this.#createId("signal", [symbol, signal_type]);
  }

  #createId(prefix, parts = []) {
    return createId({
      prefix,
      parts,
      now_provider: this.#now_provider,
      id_provider: this.#id_provider,
    });
  }
}

module.exports = {
  RunContext,
  createId,
  normalizeIdPart,
};
