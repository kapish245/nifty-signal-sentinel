require("dotenv").config();

const path = require("path");
const express = require("express");
const { createLogger: createStructuredLogger } = require("./logger/logger");

const { extractRequestToken } = require("./auth/login");
const { exchangeRequestToken } = require("./auth/token");
const { updateEnvFile } = require("./utils/envFile");

function maskToken(token) {
  if (typeof token !== "string" || token.length < 8) {
    return "***";
  }

  return `${token.slice(0, 3)}***${token.slice(-3)}`;
}

function createLogger() {
  return createStructuredLogger({ moduleName: "auth:callback" });
}

async function handleZerodhaCallback({
  query,
  logger = createLogger(),
  onTokenReceived,
} = {}) {
  const tokenHandler =
    typeof onTokenReceived === "function" ? onTokenReceived : async () => undefined;
  const requestToken = extractRequestToken(query);

  logger.info(
    { requestTokenMasked: maskToken(requestToken) },
    "Received Zerodha request token",
  );

  await tokenHandler(requestToken);

  return {
    message: "Request token captured successfully",
    requestToken,
  };
}

function createApp({ logger = createLogger(), onTokenReceived } = {}) {
  const app = express();

  app.get("/", async (req, res) => {
    try {
      const response = await handleZerodhaCallback({
        query: req.query,
        logger,
        onTokenReceived,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error(
        { error: error.message },
        "Failed to capture Zerodha request token",
      );
      res.status(400).json({
        error: error.message,
      });
    }
  });

  return app;
}

async function defaultTokenHandler(requestToken, logger) {
  const shouldUpdateEnv = process.env.ZERODHA_AUTO_UPDATE_ENV_ON_CALLBACK === "true";
  const shouldExchangeToken = process.env.ZERODHA_AUTO_EXCHANGE_ON_CALLBACK === "true";
  const envPath =
    process.env.ZERODHA_ENV_PATH ||
    path.resolve(process.cwd(), ".env");
  logger.info(
    {
      shouldUpdateEnv,
      shouldExchangeToken,
      envPath,
    },
    "Processing callback token automation settings",
  );

  if (shouldUpdateEnv) {
    await updateEnvFile({
      envPath,
      updates: {
        ZERODHA_REQUEST_TOKEN: requestToken,
      },
    });
    logger.info(
      { envPath },
      "Updated .env with Zerodha request token",
    );
  }

  if (!shouldExchangeToken) {
    return;
  }

  const tokenPath =
    process.env.ZERODHA_TOKEN_PATH ||
    path.resolve(process.cwd(), "tmp", "kite-session.json");

  await exchangeRequestToken({
    apiKey: process.env.ZERODHA_API_KEY,
    apiSecret: process.env.ZERODHA_API_SECRET,
    requestToken,
    tokenPath,
    envPath,
    persistToEnv: shouldUpdateEnv,
    logger,
  });

  logger.info(
    { tokenPath, envPath: shouldUpdateEnv ? envPath : null },
    "Persisted Zerodha access token after callback exchange",
  );
}

function startServer({
  port = Number(process.env.PORT) || 3000,
  logger = createLogger(),
  onTokenReceived,
} = {}) {
  const app = createApp({
    logger,
    onTokenReceived:
      onTokenReceived ||
      ((requestToken) => defaultTokenHandler(requestToken, logger)),
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(
        { port },
        "Zerodha callback server listening",
      );
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start Zerodha callback server", {
      error: error.message,
    });
    process.exitCode = 1;
  });
}

module.exports = {
  createApp,
  createLogger,
  handleZerodhaCallback,
  startServer,
};
