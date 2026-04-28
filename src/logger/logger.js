const fs = require("fs/promises");
const path = require("path");

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const DEFAULT_LOG_LEVEL = "info";
const REDACTED_PLACEHOLDER = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(api[-_]?key|access[-_]?token|authorization|secret|password)/i;

function normalizeLogLevel(logLevel) {
  if (typeof logLevel !== "string") {
    return DEFAULT_LOG_LEVEL;
  }

  const normalizedLevel = logLevel.trim().toLowerCase();
  return LOG_LEVELS[normalizedLevel] ? normalizedLevel : DEFAULT_LOG_LEVEL;
}

function getDatePart(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function shouldLog(activeLevel, targetLevel) {
  return LOG_LEVELS[targetLevel] >= LOG_LEVELS[activeLevel];
}

function sanitizeData(data) {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  if (!data || typeof data !== "object") {
    return data;
  }

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, REDACTED_PLACEHOLDER];
      }
      return [key, sanitizeData(value)];
    }),
  );
}

function formatConsoleLog(entry) {
  const dataSuffix = entry.data && Object.keys(entry.data).length > 0
    ? `\n${JSON.stringify(entry.data, null, 2)}`
    : "";
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}${dataSuffix}`;
}

function createLogWriter({ logsRootDir, nowProvider }) {
  return async (entry) => {
    const timestamp = nowProvider();
    const datePart = getDatePart(timestamp);
    const systemLogsDir = path.join(logsRootDir, "system");
    const logPath = path.join(systemLogsDir, `${datePart}.log`);
    const serializedEntry = `${JSON.stringify(entry)}\n`;

    try {
      await fs.mkdir(systemLogsDir, { recursive: true });
      await fs.appendFile(logPath, serializedEntry, "utf8");
    } catch (error) {
      console.error("Failed to write structured log file", {
        error: error.message,
        logPath,
      });
    }
  };
}

function resolveLoggerConfig(config = {}) {
  const envLogLevel = process.env.LOG_LEVEL;
  const logLevel = normalizeLogLevel(config.logLevel || envLogLevel);
  const enableDebugLogs = config.enableDebugLogs != null
    ? Boolean(config.enableDebugLogs)
    : process.env.ENABLE_DEBUG_LOGS !== "false";
  const logsRootDir = config.logsRootDir || path.resolve(process.cwd(), "logs");
  const nowProvider = typeof config.nowProvider === "function" ? config.nowProvider : () => new Date();
  const consoleLogger = config.consoleLogger || console;
  const enableFileLogging = config.enableFileLogging !== false;
  const enablePrettyConsole = config.enablePrettyConsole !== false;

  return {
    logLevel,
    enableDebugLogs,
    logsRootDir,
    nowProvider,
    consoleLogger,
    enableFileLogging,
    enablePrettyConsole,
  };
}

function createLogger({ moduleName = "system", ...config } = {}) {
  const resolvedConfig = resolveLoggerConfig(config);
  const fileWriter = createLogWriter({
    logsRootDir: resolvedConfig.logsRootDir,
    nowProvider: resolvedConfig.nowProvider,
  });

  function emitLog(level, data = {}, message = "") {
    if (level === "debug" && !resolvedConfig.enableDebugLogs) {
      return;
    }

    if (!shouldLog(resolvedConfig.logLevel, level)) {
      return;
    }

    const timestamp = resolvedConfig.nowProvider().toISOString();
    const safeData = sanitizeData(data);
    const entry = {
      timestamp,
      level,
      module: moduleName,
      message: String(message || ""),
      data: safeData,
    };

    if (resolvedConfig.enablePrettyConsole) {
      const formatted = formatConsoleLog(entry);
      if (level === "error") {
        resolvedConfig.consoleLogger.error(formatted);
      } else if (level === "warn") {
        resolvedConfig.consoleLogger.warn(formatted);
      } else {
        resolvedConfig.consoleLogger.log(formatted);
      }
    } else {
      resolvedConfig.consoleLogger.log(JSON.stringify(entry));
    }

    if (resolvedConfig.enableFileLogging) {
      void fileWriter(entry);
    }
  }

  return {
    getLevel() {
      return resolvedConfig.logLevel;
    },
    debug(data, message) {
      emitLog("debug", data, message);
    },
    info(data, message) {
      emitLog("info", data, message);
    },
    warn(data, message) {
      emitLog("warn", data, message);
    },
    error(data, message) {
      emitLog("error", data, message);
    },
    child(childModuleName) {
      return createLogger({
        ...resolvedConfig,
        moduleName: childModuleName || moduleName,
      });
    },
  };
}

module.exports = {
  createLogger,
  LOG_LEVELS,
  normalizeLogLevel,
  sanitizeData,
};
