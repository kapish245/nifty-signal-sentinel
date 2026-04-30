const axios = require("axios");

const { KITE_API_BASE_URL } = require("./kiteClient");

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_MAX_STRIKES = 10;

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
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

function parseInstrumentCsv(csvText) {
  const lines = String(csvText || "").trim().split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => parseInstrumentLine({ headers, line }));
}

function parseInstrumentLine({ headers, line }) {
  const values = line.split(",");
  return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
}

function normalizeUnderlyingSymbol(symbol) {
  return requireNonEmptyString(symbol, "Symbol")
    .replace(/^NSE:/, "")
    .replace(/-EQ$/, "")
    .trim()
    .toUpperCase();
}

function normalizeInstrument(row) {
  return {
    instrument_token: Number(row.instrument_token),
    exchange_token: Number(row.exchange_token),
    tradingsymbol: row.tradingsymbol,
    name: row.name,
    expiry: row.expiry,
    strike: Number(row.strike),
    tick_size: Number(row.tick_size),
    lot_size: Number(row.lot_size),
    instrument_type: row.instrument_type,
    segment: row.segment,
    exchange: row.exchange,
  };
}

function getNearestExpiry(instruments, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const expiries = instruments
    .map((instrument) => instrument.expiry)
    .filter((expiry) => expiry >= today)
    .sort();

  return expiries[0] || null;
}

function selectOptionInstruments({ instruments, underlying, spotPrice, expiry, maxStrikes }) {
  const optionInstruments = instruments
    .map(normalizeInstrument)
    .filter((instrument) => isMatchingOption({ instrument, underlying }));
  const selectedExpiry = expiry || getNearestExpiry(optionInstruments);

  if (!selectedExpiry) {
    return [];
  }

  return optionInstruments
    .filter((instrument) => instrument.expiry === selectedExpiry)
    .sort((left, right) => Math.abs(left.strike - spotPrice) - Math.abs(right.strike - spotPrice))
    .slice(0, maxStrikes * 2)
    .sort((left, right) => left.strike - right.strike || left.instrument_type.localeCompare(right.instrument_type));
}

function isMatchingOption({ instrument, underlying }) {
  return instrument.exchange === "NFO" &&
    instrument.segment === "NFO-OPT" &&
    ["CE", "PE"].includes(instrument.instrument_type) &&
    instrument.name === underlying &&
    Number.isFinite(instrument.strike) &&
    instrument.strike > 0;
}

function buildQuoteSymbols(instruments) {
  return instruments.map((instrument) => `NFO:${instrument.tradingsymbol}`);
}

function normalizeContract({ instrument, quote }) {
  const lastPrice = quote?.last_price;
  const previousClose = quote?.ohlc?.close;

  return {
    symbol: `NFO:${instrument.tradingsymbol}`,
    tradingsymbol: instrument.tradingsymbol,
    expiry: instrument.expiry,
    strike: instrument.strike,
    optionType: instrument.instrument_type,
    lastPrice: typeof lastPrice === "number" ? lastPrice : null,
    priceChange: getPriceChange({ lastPrice, previousClose }),
    volume: typeof quote?.volume === "number" ? quote.volume : 0,
    oi: typeof quote?.oi === "number" ? quote.oi : 0,
    oiChange: typeof quote?.oi_day_high === "number" && typeof quote?.oi_day_low === "number"
      ? quote.oi_day_high - quote.oi_day_low
      : null,
    bid: quote?.depth?.buy?.[0]?.price || null,
    ask: quote?.depth?.sell?.[0]?.price || null,
  };
}

function getPriceChange({ lastPrice, previousClose }) {
  if (typeof lastPrice !== "number" || typeof previousClose !== "number") {
    return null;
  }

  return Number((lastPrice - previousClose).toFixed(2));
}

function createKiteDerivativesClient({
  apiKey,
  accessToken,
  httpClient = axios,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  baseUrl = KITE_API_BASE_URL,
  logger = createDefaultLogger(),
  maxRetries = DEFAULT_MAX_RETRIES,
  rateLimiter,
  nowProvider = () => new Date(),
} = {}) {
  const normalizedApiKey = requireNonEmptyString(apiKey, "API key");
  const normalizedAccessToken = requireNonEmptyString(accessToken, "Access token");
  let cachedInstruments = null;

  async function request(path) {
    return runWithRateLimiter(rateLimiter, () => requestWithRetry({ path }));
  }

  async function requestWithRetry({ path }) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await httpClient.get(`${baseUrl}${path}`, {
          headers: getHeaders({ apiKey: normalizedApiKey, accessToken: normalizedAccessToken }),
          timeout: timeoutMs,
        });
      } catch (error) {
        if (!isRetryableError(error) || attempt >= maxRetries) throw error;
        logger.warn({ attempt: attempt + 1, message: getErrorMessage(error), path }, "Retrying Zerodha request");
        await delay(250 * (attempt + 1));
      }
    }

    throw new Error("Unreachable Zerodha retry state");
  }

  return {
    async getOptionChain({ symbol, spotPrice, expiry, maxStrikes = DEFAULT_MAX_STRIKES }) {
      const underlying = normalizeUnderlyingSymbol(symbol);
      const instruments = await getCachedInstruments();
      const selectedInstruments = selectOptionInstruments({
        instruments,
        underlying,
        spotPrice,
        expiry,
        maxStrikes,
      });

      if (selectedInstruments.length === 0) {
        return { underlying, spotPrice, expiry: expiry || null, contracts: [] };
      }

      const quotes = await getQuotes(selectedInstruments);
      return {
        underlying,
        spotPrice,
        expiry: selectedInstruments[0]?.expiry || expiry || null,
        contracts: selectedInstruments.map((instrument) => normalizeContract({
          instrument,
          quote: quotes[`NFO:${instrument.tradingsymbol}`],
        })),
      };
    },
  };

  async function getCachedInstruments() {
    if (cachedInstruments) {
      return cachedInstruments;
    }

    const response = await request("/instruments/NFO");
    cachedInstruments = parseInstrumentCsv(response?.data);
    return cachedInstruments;
  }

  async function getQuotes(instruments) {
    const query = new URLSearchParams();
    buildQuoteSymbols(instruments).forEach((symbol) => query.append("i", symbol));
    const response = await request(`/quote?${query}`);

    return response?.data?.data || {};
  }
}

function getHeaders({ apiKey, accessToken }) {
  return {
    "X-Kite-Version": "3",
    Authorization: `token ${apiKey}:${accessToken}`,
  };
}

module.exports = {
  createKiteDerivativesClient,
  normalizeUnderlyingSymbol,
  parseInstrumentCsv,
  selectOptionInstruments,
};
