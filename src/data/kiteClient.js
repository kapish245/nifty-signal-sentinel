const axios = require("axios");

const KITE_API_BASE_URL = "https://api.kite.trade";
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

async function runWithRateLimiter(rateLimiter, task) {
  if (!rateLimiter) {
    return task();
  }

  if (typeof rateLimiter.schedule !== "function") {
    throw new Error("rateLimiter must expose schedule(task)");
  }

  return rateLimiter.schedule(task);
}

function validateLtpResponse(payload, symbol) {
  const symbolPayload = payload?.data?.[symbol];
  const lastPrice = symbolPayload?.last_price;

  if (
    payload?.status !== "success" ||
    !symbolPayload ||
    typeof lastPrice !== "number"
  ) {
    throw new Error(`LTP data missing for symbol: ${symbol}`);
  }

  return symbolPayload;
}

function createKiteClient({
  apiKey,
  accessToken,
  httpClient = axios,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  baseUrl = KITE_API_BASE_URL,
  logger = createDefaultLogger(),
  maxRetries = DEFAULT_MAX_RETRIES,
  rateLimiter,
}) {
  const normalizedApiKey = requireNonEmptyString(apiKey, "API key");
  const normalizedAccessToken = requireNonEmptyString(
    accessToken,
    "Access token",
  );

  return {
    async getLTP(symbol) {
      const normalizedSymbol = requireNonEmptyString(symbol, "Symbol");
      const query = new URLSearchParams({ i: normalizedSymbol });
      return runWithRateLimiter(rateLimiter, async () => {
        let response;

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            response = await httpClient.get(`${baseUrl}/quote/ltp?${query}`, {
              headers: {
                "X-Kite-Version": "3",
                Authorization: `token ${normalizedApiKey}:${normalizedAccessToken}`,
              },
              timeout: timeoutMs,
            });
            break;
          } catch (error) {
            if (isRetryableError(error) && attempt < maxRetries) {
              logger.warn(
                { attempt: attempt + 1, message: getErrorMessage(error), symbol },
                "Retrying Zerodha LTP request",
              );
              await delay(250 * (attempt + 1));
              continue;
            }

            logger.error(
              { message: getErrorMessage(error), symbol },
              "Zerodha LTP request failed",
            );
            throw new Error(`Failed to fetch LTP: ${getErrorMessage(error)}`);
          }
        }

        const symbolPayload = validateLtpResponse(response?.data, normalizedSymbol);

        return {
          symbol: normalizedSymbol,
          instrumentToken: symbolPayload.instrument_token,
          lastPrice: symbolPayload.last_price,
          raw: symbolPayload,
        };
      });
    },
  };
}

module.exports = {
  createKiteClient,
  validateLtpResponse,
  KITE_API_BASE_URL,
};
