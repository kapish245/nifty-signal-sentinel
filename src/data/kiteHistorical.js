const axios = require("axios");

const { KITE_API_BASE_URL, createKiteClient } = require("./kiteClient");

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 1;
const SUPPORTED_INTERVALS = new Set(["minute", "5minute", "15minute", "day"]);
const INTERVAL_MINUTES = {
  minute: 1,
  "5minute": 5,
  "15minute": 15,
  day: 24 * 60,
};

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function requireSupportedInterval(interval) {
  const normalizedInterval = requireNonEmptyString(interval, "Interval");

  if (!SUPPORTED_INTERVALS.has(normalizedInterval)) {
    throw new Error("Interval must be one of: minute, 5minute, 15minute, day");
  }

  return normalizedInterval;
}

function requireLookbackMinutes(lookbackMinutes) {
  if (
    !Number.isInteger(lookbackMinutes) ||
    lookbackMinutes <= 0
  ) {
    throw new Error("lookbackMinutes must be a positive integer");
  }

  return lookbackMinutes;
}

function requireTargetCandles(targetCandles) {
  if (!Number.isInteger(targetCandles) || targetCandles <= 0) {
    throw new Error("targetCandles must be a positive integer");
  }

  return targetCandles;
}

function requireInstrumentToken(instrumentToken) {
  if (
    typeof instrumentToken !== "number" ||
    !Number.isFinite(instrumentToken) ||
    instrumentToken <= 0
  ) {
    throw new Error("Instrument token is required");
  }

  return instrumentToken;
}

function createDefaultLogger() {
  return {
    debug: () => undefined,
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

function formatDateTime(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = valueByType.year;
  const month = valueByType.month;
  const day = valueByType.day;
  const hours = valueByType.hour;
  const minutes = valueByType.minute;
  const seconds = valueByType.second;

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeCandle(candle) {
  if (!Array.isArray(candle) || candle.length < 6) {
    throw new Error("Historical candle payload is invalid");
  }

  const [timestamp, open, high, low, close, volume] = candle;

  if (
    typeof open !== "number" ||
    typeof high !== "number" ||
    typeof low !== "number" ||
    typeof close !== "number" ||
    typeof volume !== "number"
  ) {
    throw new Error("Historical candle payload contains invalid values");
  }

  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  };
}

function validateHistoricalResponse(payload) {
  const candles = payload?.data?.candles;

  if (payload?.status !== "success" || !Array.isArray(candles)) {
    throw new Error("Historical candle data missing in Zerodha response");
  }

  return candles.map(normalizeCandle);
}

function getDefaultMaxLookbackMinutes(interval) {
  if (interval === "day") return 140 * 24 * 60;
  if (interval === "15minute") return 14 * 24 * 60;
  if (interval === "5minute") return 7 * 24 * 60;

  return 2 * 24 * 60;
}

function buildLookbackSequence({
  interval,
  targetCandles,
  maxLookbackMinutes,
} = {}) {
  const intervalMinutes = INTERVAL_MINUTES[interval];
  const minimumLookback = Math.max(intervalMinutes * targetCandles, intervalMinutes * 50);
  const lookbacks = [];
  let nextLookback = minimumLookback;

  while (nextLookback < maxLookbackMinutes) {
    lookbacks.push(nextLookback);
    nextLookback *= 2;
  }

  lookbacks.push(maxLookbackMinutes);
  return [...new Set(lookbacks)];
}

function createHistoricalDataClient({
  apiKey,
  accessToken,
  httpClient = axios,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  baseUrl = KITE_API_BASE_URL,
  logger = createDefaultLogger(),
  maxRetries = DEFAULT_MAX_RETRIES,
  instrumentTokenResolver,
  nowProvider = () => new Date(),
  rateLimiter,
} = {}) {
  const normalizedApiKey = requireNonEmptyString(apiKey, "API key");
  const normalizedAccessToken = requireNonEmptyString(
    accessToken,
    "Access token",
  );
  const fallbackKiteClient = createKiteClient({
    apiKey: normalizedApiKey,
    accessToken: normalizedAccessToken,
    httpClient,
    timeoutMs,
    baseUrl,
    logger,
    maxRetries,
  });
  const resolveInstrumentToken =
    typeof instrumentTokenResolver === "function"
      ? instrumentTokenResolver
      : async (symbol) => {
          const snapshot = await fallbackKiteClient.getLTP(symbol);
          return snapshot.instrumentToken;
        };

  return {
    async getHistoricalCandles(
      symbol,
      interval,
      lookbackMinutes,
      options = {},
    ) {
      const normalizedSymbol = requireNonEmptyString(symbol, "Symbol");
      const normalizedInterval = requireSupportedInterval(interval);
      const normalizedLookbackMinutes = requireLookbackMinutes(lookbackMinutes);

      const instrumentToken = requireInstrumentToken(
        typeof options.instrumentToken === "number"
          ? options.instrumentToken
          : await resolveInstrumentToken(normalizedSymbol),
      );

      const toDate = nowProvider();

      if (!(toDate instanceof Date) || Number.isNaN(toDate.getTime())) {
        throw new Error("nowProvider must return a valid Date");
      }

      const fromDate = new Date(
        toDate.getTime() - normalizedLookbackMinutes * 60 * 1000,
      );
      const query = new URLSearchParams({
        from: formatDateTime(fromDate),
        to: formatDateTime(toDate),
        oi: "1",
      });
      logger.debug(
        {
          symbol: normalizedSymbol,
          interval: normalizedInterval,
          lookbackMinutes: normalizedLookbackMinutes,
          from: formatDateTime(fromDate),
          to: formatDateTime(toDate),
          marketContext: options.marketContext || null,
        },
        "Fetching Zerodha historical candles",
      );
      return runWithRateLimiter(rateLimiter, async () => {
        let response;

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            response = await httpClient.get(
              `${baseUrl}/instruments/historical/${instrumentToken}/${normalizedInterval}?${query}`,
              {
                headers: {
                  "X-Kite-Version": "3",
                  Authorization: `token ${normalizedApiKey}:${normalizedAccessToken}`,
                },
                timeout: timeoutMs,
              },
            );
            break;
          } catch (error) {
            if (isRetryableError(error) && attempt < maxRetries) {
              logger.warn(
                {
                  attempt: attempt + 1,
                  interval: normalizedInterval,
                  lookbackMinutes: normalizedLookbackMinutes,
                  message: getErrorMessage(error),
                  symbol: normalizedSymbol,
                },
                "Retrying Zerodha historical candle request",
              );
              await delay(250 * (attempt + 1));
              continue;
            }

            logger.error(
              {
                interval: normalizedInterval,
                lookbackMinutes: normalizedLookbackMinutes,
                message: getErrorMessage(error),
                symbol: normalizedSymbol,
              },
              "Zerodha historical candle request failed",
            );
            throw new Error(
              `Failed to fetch historical candles: ${getErrorMessage(error)}`,
            );
          }
        }

        return validateHistoricalResponse(response?.data);
      });
    },
    async getHistoricalCandlesByCount(
      symbol,
      interval,
      targetCandles,
      options = {},
    ) {
      const normalizedSymbol = requireNonEmptyString(symbol, "Symbol");
      const normalizedInterval = requireSupportedInterval(interval);
      const normalizedTargetCandles = requireTargetCandles(targetCandles);
      const maxLookbackMinutes = requireLookbackMinutes(
        options.maxLookbackMinutes || getDefaultMaxLookbackMinutes(normalizedInterval),
      );
      const lookbackSequence = buildLookbackSequence({
        interval: normalizedInterval,
        targetCandles: normalizedTargetCandles,
        maxLookbackMinutes,
      });
      let candles = [];

      for (const lookbackMinutes of lookbackSequence) {
        candles = await this.getHistoricalCandles(
          normalizedSymbol,
          normalizedInterval,
          lookbackMinutes,
          options,
        );
        logger.debug(
          {
            symbol: normalizedSymbol,
            interval: normalizedInterval,
            targetCandles: normalizedTargetCandles,
            receivedCandles: candles.length,
            lookbackMinutes,
            maxLookbackMinutes,
            marketContext: options.marketContext || null,
          },
          "Evaluated historical candle count fetch",
        );
        if (candles.length >= normalizedTargetCandles) {
          return candles.slice(-normalizedTargetCandles);
        }
      }

      return candles;
    },
  };
}

module.exports = {
  createHistoricalDataClient,
  buildLookbackSequence,
  formatDateTime,
  getDefaultMaxLookbackMinutes,
  normalizeCandle,
  validateHistoricalResponse,
};
