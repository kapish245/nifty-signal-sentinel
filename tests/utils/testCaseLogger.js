const fs = require("fs");
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

function safeSerialize(payload) {
  if (typeof payload === "undefined") {
    return "null";
  }

  try {
    return JSON.stringify(payload);
  } catch (error) {
    return JSON.stringify({
      serializationError: error.message,
    });
  }
}

function resolveTestLogPath(now) {
  const day = getDatePart(now);
  const testsDir = path.resolve(process.cwd(), "logs", "tests", "day");
  return {
    testsDir,
    filePath: path.join(testsDir, `${day}.log`),
  };
}

function writeTestLogEntry(entry) {
  const now = new Date();
  const { testsDir, filePath } = resolveTestLogPath(now);

  try {
    fs.mkdirSync(testsDir, { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    if (process.env.TEST_LOG_CONSOLE !== "false") {
      console.error("Failed to write test log entry:", error.message);
    }
  }
}

function logToConsole(name, input, output) {
  if (process.env.TEST_LOG_CONSOLE === "false") {
    return;
  }
  console.log("TEST:", name);
  console.log("INPUT:", JSON.stringify(input));
  console.log("OUTPUT:", JSON.stringify(output, null, 2));
}

function logTestCase(name, input, output) {
  const now = new Date();
  const entry = {
    timestamp: now.toISOString(),
    level: "info",
    module: "tests",
    message: name,
    data: {
      input: JSON.parse(safeSerialize(input)),
      output: JSON.parse(safeSerialize(output)),
    },
  };

  writeTestLogEntry(entry);
  logToConsole(name, input, output);
}

module.exports = {
  logTestCase,
};
