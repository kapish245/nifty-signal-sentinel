const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const axios = require("axios");

jest.mock("axios");

const {
  exchangeRequestToken,
  loadPersistedToken,
  persistAccessToken,
} = require("../src/auth/token");
const { createKiteClient } = require("../src/data/kiteClient");
const { createHistoricalDataClient } = require("../src/data/kiteHistorical");

describe("Zerodha session exchange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should exchange request_token for access_token", async () => {
    axios.post.mockResolvedValue({
      data: {
        status: "success",
        data: {
          access_token: "access_123",
          public_token: "public_123",
        },
      },
    });

    const result = await exchangeRequestToken({
      apiKey: "kite_key",
      apiSecret: "kite_secret",
      requestToken: "request_123",
    });

    expect(result).toEqual({
      accessToken: "access_123",
      publicToken: "public_123",
      raw: {
        access_token: "access_123",
        public_token: "public_123",
      },
    });
    expect(axios.post).toHaveBeenCalledWith(
      "https://api.kite.trade/session/token",
      expect.any(URLSearchParams),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Kite-Version": "3",
        },
        timeout: 10000,
      },
    );
  });

  it("should throw a clear error when the session API fails", async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: "Invalid checksum",
        },
      },
    });

    await expect(
      exchangeRequestToken({
        apiKey: "kite_key",
        apiSecret: "kite_secret",
        requestToken: "bad_request",
      }),
    ).rejects.toThrow("Failed to exchange request token: Invalid checksum");
  });

  it("should throw when the API response is invalid", async () => {
    axios.post.mockResolvedValue({
      data: {
        status: "success",
        data: {},
      },
    });

    await expect(
      exchangeRequestToken({
        apiKey: "kite_key",
        apiSecret: "kite_secret",
        requestToken: "request_123",
      }),
    ).rejects.toThrow("Access token missing in Zerodha session response");
  });

  it("should persist and reload the access token from disk", async () => {
    const tokenPath = path.join(
      os.tmpdir(),
      `kite-token-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );

    await persistAccessToken({
      tokenPath,
      tokenData: {
        accessToken: "stored_access",
        publicToken: "stored_public",
      },
    });

    await expect(loadPersistedToken({ tokenPath })).resolves.toEqual({
      accessToken: "stored_access",
      publicToken: "stored_public",
    });

    await fs.rm(tokenPath, { force: true });
  });

  it("should update the env file when requested", async () => {
    axios.post.mockResolvedValue({
      data: {
        status: "success",
        data: {
          access_token: "access_456",
          public_token: "public_456",
        },
      },
    });
    const envPath = path.join(
      os.tmpdir(),
      `kite-env-${Date.now()}-${Math.random().toString(16).slice(2)}.env`,
    );

    await exchangeRequestToken({
      apiKey: "kite_key",
      apiSecret: "kite_secret",
      requestToken: "request_456",
      envPath,
      persistToEnv: true,
    });

    const contents = await fs.readFile(envPath, "utf8");

    expect(contents).toContain("ZERODHA_REQUEST_TOKEN=request_456");
    expect(contents).toContain("ZERODHA_ACCESS_TOKEN=access_456");

    await fs.rm(envPath, { force: true });
  });

  const runLiveTests = process.env.RUN_LIVE_KITE_TESTS === "true";
  const liveDescribe = runLiveTests ? describe : describe.skip;

  liveDescribe("live health check", () => {
    it("should validate real Kite session exchange when credentials are present", async () => {
      const result = await exchangeRequestToken({
        apiKey: process.env.ZERODHA_API_KEY,
        apiSecret: process.env.ZERODHA_API_SECRET,
        requestToken: process.env.ZERODHA_REQUEST_TOKEN,
      });

      expect(result.accessToken).toEqual(expect.any(String));
    });
  });
});

describe("Kite market data client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch LTP using the required headers", async () => {
    axios.get.mockResolvedValue({
      data: {
        status: "success",
        data: {
          "NSE:INFY": {
            instrument_token: 408065,
            last_price: 1520.4,
          },
        },
      },
    });

    const client = createKiteClient({
      apiKey: "kite_key",
      accessToken: "access_123",
    });

    const result = await client.getLTP("NSE:INFY");

    expect(result).toEqual({
      symbol: "NSE:INFY",
      instrumentToken: 408065,
      lastPrice: 1520.4,
      raw: {
        instrument_token: 408065,
        last_price: 1520.4,
      },
    });
    expect(axios.get).toHaveBeenCalledWith(
      "https://api.kite.trade/quote/ltp?i=NSE%3AINFY",
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: "token kite_key:access_123",
        },
        timeout: 10000,
      },
    );
  });

  it("should reject invalid symbols", async () => {
    const client = createKiteClient({
      apiKey: "kite_key",
      accessToken: "access_123",
    });

    await expect(client.getLTP("")).rejects.toThrow("Symbol is required");
  });

  it("should throw a clear error when the LTP API rejects the access token", async () => {
    axios.get.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: "Invalid session",
        },
      },
    });

    const client = createKiteClient({
      apiKey: "kite_key",
      accessToken: "access_123",
    });

    await expect(client.getLTP("NSE:INFY")).rejects.toThrow(
      "Failed to fetch LTP: Invalid session",
    );
  });

  it("should throw when access token is missing", () => {
    expect(() =>
      createKiteClient({
        apiKey: "kite_key",
        accessToken: "",
      }),
    ).toThrow("Access token is required");
  });

  it("should fetch historical candles using the required Zerodha route", async () => {
    axios.get.mockResolvedValue({
      data: {
        status: "success",
        data: {
          candles: [
            ["2026-04-28T09:15:00+05:30", 100, 102, 99, 101, 1000, 0],
            ["2026-04-28T09:20:00+05:30", 101, 103, 100, 102, 1200, 0],
          ],
        },
      },
    });

    const client = createHistoricalDataClient({
      apiKey: "kite_key",
      accessToken: "access_123",
      instrumentTokenResolver: jest.fn().mockResolvedValue(408065),
      nowProvider: () => new Date("2026-04-28T10:00:00.000Z"),
    });

    const result = await client.getHistoricalCandles("NSE:INFY", "minute", 50);

    expect(result).toEqual([
      {
        timestamp: "2026-04-28T09:15:00+05:30",
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
      {
        timestamp: "2026-04-28T09:20:00+05:30",
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 1200,
      },
    ]);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://api.kite.trade/instruments/historical/408065/minute?",
      ),
      {
        headers: {
          "X-Kite-Version": "3",
          Authorization: "token kite_key:access_123",
        },
        timeout: 10000,
      },
    );
  });
});
