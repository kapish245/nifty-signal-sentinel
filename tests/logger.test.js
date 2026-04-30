const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const { createLogger, sanitizeData } = require("../src/logger/logger");

function waitForLogFlush() {
  return new Promise((resolve) => setTimeout(resolve, 60));
}

describe("structured logger", () => {
  it("writes structured JSON logs to daily system file", async () => {
    const logsRootDir = await fs.mkdtemp(path.join(os.tmpdir(), "nss-logs-"));
    const logger = createLogger({
      moduleName: "tests:logger",
      logsRootDir,
      logLevel: "debug",
      enablePrettyConsole: false,
    });

    logger.info({ symbol: "NSE:INFY", signal_type: "INTRADAY_LONG" }, "Signal logged");
    await waitForLogFlush();

    const systemDir = path.join(logsRootDir, "system");
    const [logFile] = await fs.readdir(systemDir);
    const contents = await fs.readFile(path.join(systemDir, logFile), "utf8");
    const [line] = contents.trim().split("\n");
    const entry = JSON.parse(line);

    expect(entry).toMatchObject({
      level: "info",
      module: "tests:logger",
      message: "Signal logged",
      data: {
        symbol: "NSE:INFY",
        signal_type: "INTRADAY_LONG",
      },
    });
  });

  it("redacts sensitive fields from payload", () => {
    const sanitized = sanitizeData({
      apiKey: "kite_key",
      access_token: "token",
      nested: {
        authorization: "Bearer value",
      },
    });

    expect(sanitized).toEqual({
      apiKey: "[REDACTED]",
      access_token: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
      },
    });
  });
});
