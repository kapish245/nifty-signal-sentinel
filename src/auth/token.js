const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");

const { generateChecksum } = require("../utils/checksum");
const { updateEnvFile } = require("../utils/envFile");

const KITE_SESSION_URL = "https://api.kite.trade/session/token";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 1;

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function createDefaultLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unknown error"
  );
}

function isRetryableError(error) {
  if (!error?.response) {
    return true;
  }

  return error.response.status >= 500;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function validateSessionResponse(payload) {
  const sessionData = payload?.data;
  const accessToken = sessionData?.access_token;

  if (payload?.status !== "success" || typeof accessToken !== "string") {
    throw new Error("Access token missing in Zerodha session response");
  }

  return sessionData;
}

async function persistAccessToken({ tokenPath, tokenData }) {
  const normalizedTokenPath = requireNonEmptyString(tokenPath, "Token path");

  if (!tokenData || typeof tokenData !== "object") {
    throw new Error("Token data is required");
  }

  const payload = {
    accessToken: requireNonEmptyString(tokenData.accessToken, "Access token"),
    publicToken:
      typeof tokenData.publicToken === "string" && tokenData.publicToken.trim()
        ? tokenData.publicToken.trim()
        : null,
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(normalizedTokenPath), { recursive: true });
  await fs.writeFile(
    normalizedTokenPath,
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  return payload;
}

async function loadPersistedToken({ tokenPath }) {
  const normalizedTokenPath = requireNonEmptyString(tokenPath, "Token path");

  try {
    const fileContents = await fs.readFile(normalizedTokenPath, "utf8");
    const parsed = JSON.parse(fileContents);

    return {
      accessToken: requireNonEmptyString(parsed.accessToken, "Access token"),
      publicToken:
        typeof parsed.publicToken === "string" && parsed.publicToken.trim()
          ? parsed.publicToken.trim()
          : null,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new Error("Persisted token file is not valid JSON");
    }

    throw error;
  }
}

async function exchangeRequestToken({
  apiKey,
  apiSecret,
  requestToken,
  httpClient = axios,
  logger = createDefaultLogger(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  tokenPath,
  envPath,
  persistToEnv = false,
}) {
  const normalizedApiKey = requireNonEmptyString(apiKey, "API key");
  const normalizedApiSecret = requireNonEmptyString(apiSecret, "API secret");
  const normalizedRequestToken = requireNonEmptyString(
    requestToken,
    "Request token",
  );
  const checksum = generateChecksum({
    apiKey: normalizedApiKey,
    requestToken: normalizedRequestToken,
    apiSecret: normalizedApiSecret,
  });
  const body = new URLSearchParams({
    api_key: normalizedApiKey,
    request_token: normalizedRequestToken,
    checksum,
  });

  let response;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      response = await httpClient.post(KITE_SESSION_URL, body, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Kite-Version": "3",
        },
        timeout: timeoutMs,
      });
      break;
    } catch (error) {
      if (isRetryableError(error) && attempt < maxRetries) {
        logger.warn(
          { attempt: attempt + 1, message: getErrorMessage(error) },
          "Retrying Zerodha session exchange",
        );
        await delay(250 * (attempt + 1));
        continue;
      }

      logger.error(
        { message: getErrorMessage(error) },
        "Zerodha session exchange failed",
      );
      throw new Error(
        `Failed to exchange request token: ${getErrorMessage(error)}`,
      );
    }
  }

  const sessionData = validateSessionResponse(response?.data);
  const tokenResult = {
    accessToken: sessionData.access_token,
    publicToken:
      typeof sessionData.public_token === "string"
        ? sessionData.public_token
        : null,
    raw: sessionData,
  };

  if (tokenPath) {
    await persistAccessToken({
      tokenPath,
      tokenData: {
        accessToken: tokenResult.accessToken,
        publicToken: tokenResult.publicToken,
      },
    });
  }

  if (persistToEnv) {
    await updateEnvFile({
      envPath,
      updates: {
        ZERODHA_REQUEST_TOKEN: normalizedRequestToken,
        ZERODHA_ACCESS_TOKEN: tokenResult.accessToken,
      },
    });
  }

  logger.info(
    {
      tokenPath: tokenPath || null,
      envPath: persistToEnv ? envPath || path.resolve(process.cwd(), ".env") : null,
    },
    "Zerodha access token exchanged successfully",
  );

  return tokenResult;
}

module.exports = {
  exchangeRequestToken,
  loadPersistedToken,
  persistAccessToken,
  validateSessionResponse,
  KITE_SESSION_URL,
};
