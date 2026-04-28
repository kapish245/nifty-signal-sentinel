const path = require("path");

const { loadPersistedToken } = require("../src/auth/token");
const { createKiteClient } = require("../src/data/kiteClient");
const { createHistoricalDataClient } = require("../src/data/kiteHistorical");
const { createSignalService } = require("../src/services/signalService");
const { createScannerService } = require("../src/scanner/scannerService");

async function resolveLiveAccessToken() {
  if (process.env.ZERODHA_ACCESS_TOKEN) {
    return process.env.ZERODHA_ACCESS_TOKEN;
  }

  const tokenPath =
    process.env.ZERODHA_TOKEN_PATH ||
    path.resolve(process.cwd(), "tmp", "kite-session.json");
  const persistedToken = await loadPersistedToken({ tokenPath });

  return persistedToken?.accessToken || null;
}

describe("live market data integration", () => {
  const runLiveTests = process.env.RUN_LIVE_KITE_TESTS === "true";
  const liveDescribe = runLiveTests ? describe : describe.skip;

  liveDescribe("Zerodha live routes", () => {
    let accessToken;
    let kiteClient;
    let historicalClient;
    let signalService;

    beforeAll(async () => {
      accessToken = await resolveLiveAccessToken();

      if (!process.env.ZERODHA_API_KEY) {
        throw new Error("ZERODHA_API_KEY is required for live tests");
      }

      if (!accessToken) {
        throw new Error(
          "A valid Zerodha access token is required for live market-data tests",
        );
      }

      kiteClient = createKiteClient({
        apiKey: process.env.ZERODHA_API_KEY,
        accessToken,
      });
      historicalClient = createHistoricalDataClient({
        apiKey: process.env.ZERODHA_API_KEY,
        accessToken,
      });
      signalService = createSignalService({
        kiteClient,
        historicalClient,
      });
    }, 20000);

    it(
      "fetches live LTP for INFY",
      async () => {
        const snapshot = await kiteClient.getLTP("NSE:INFY");

        expect(snapshot.symbol).toBe("NSE:INFY");
        expect(snapshot.instrumentToken).toEqual(expect.any(Number));
        expect(snapshot.lastPrice).toEqual(expect.any(Number));
        expect(snapshot.lastPrice).toBeGreaterThan(0);
      },
      20000,
    );

    it(
      "fetches live historical candles for INFY",
      async () => {
        const candles = await historicalClient.getHistoricalCandles(
          "NSE:INFY",
          "5minute",
          600,
        );

        expect(Array.isArray(candles)).toBe(true);
        expect(candles.length).toBeGreaterThan(0);
        expect(candles[0]).toEqual(
          expect.objectContaining({
            open: expect.any(Number),
            high: expect.any(Number),
            low: expect.any(Number),
            close: expect.any(Number),
            volume: expect.any(Number),
          }),
        );
      },
      30000,
    );

    it(
      "builds a live signal for INFY",
      async () => {
        const signal = await signalService.getSignal("NSE:INFY");

        expect(signal).toEqual(
          expect.objectContaining({
            symbol: "NSE:INFY",
            ltp: expect.any(Number),
            signal: expect.stringMatching(/HOLD|SELL|NO_TRADE/),
          }),
        );
        if (signal.reason === "INSUFFICIENT_DATA") {
          expect(signal.indicators).toBeNull();
          expect(signal.meta).toEqual(
            expect.objectContaining({
              receivedCandles: expect.any(Number),
              requiredCandles: 50,
            }),
          );
        } else {
          expect(signal.indicators).toEqual(expect.any(Object));
        }
      },
      30000,
    );

    it(
      "scans a small live subset and succeeds for at least one stock",
      async () => {
        const scannerService = createScannerService({
          signalService,
          symbols: ["INFY", "RELIANCE"],
        });

        const result = await scannerService.scanMarket();

        expect(result.requestedCount).toBe(2);
        expect(result.scannedCount).toBeGreaterThan(0);
        expect(result.failures.length).toBeLessThan(2);
      },
      45000,
    );
  });
});
