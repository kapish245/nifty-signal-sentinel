require("dotenv").config();

const { generateLoginUrl } = require("../auth/login");
const { createLogger } = require("../logger/logger");

const logger = createLogger({ moduleName: "auth:loginUrl" });

try {
  const loginUrl = generateLoginUrl(process.env.ZERODHA_API_KEY);
  logger.info(
    {
      hasApiKey: typeof process.env.ZERODHA_API_KEY === "string" && process.env.ZERODHA_API_KEY.trim() !== "",
    },
    "Generated Zerodha login URL",
  );
  console.log(loginUrl);
} catch (error) {
  logger.error({ error: error.message }, "Failed to generate Zerodha login URL");
  console.error(error.message);
  process.exitCode = 1;
}
