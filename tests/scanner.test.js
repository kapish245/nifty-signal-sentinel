const {
  createScannerService,
  isFatalScanError,
} = require("../src/scanner/scannerService");
const { logTestCase } = require("./utils/testCaseLogger");

describe("scannerService", () => {
  it("scans multiple stocks and returns only actionable intraday signals", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "INTRADAY_LONG",
          signal_type: "INTRADAY_LONG",
          ltp: 1500,
          indicators: { rsi: 61 },
        })
        .mockResolvedValueOnce({
          symbol: "NSE:TCS",
          signal: "NO_TRADE",
          ltp: 3900,
          indicators: { rsi: 49 },
        })
        .mockResolvedValueOnce({
          symbol: "NSE:RELIANCE",
          signal: "INTRADAY_SHORT",
          signal_type: "INTRADAY_SHORT",
          ltp: 2500,
          indicators: { rsi: 35 },
        }),
    };
    const signalLogger = {
      logSignal: jest.fn().mockResolvedValue(undefined),
    };
    const discordNotifier = {
      logSignal: jest.fn().mockResolvedValue(undefined),
    };

    const scannerService = createScannerService({
      signalService,
      signalLogger,
      discordNotifier,
      symbols: ["INFY", "TCS", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();
    logTestCase(
      "scannerService: filters meaningful signals",
      { symbols: ["INFY", "TCS", "RELIANCE"] },
      result,
    );

    expect(signalService.getSignal).toHaveBeenNthCalledWith(1, "NSE:INFY", expect.any(Object));
    expect(signalService.getSignal).toHaveBeenNthCalledWith(2, "NSE:TCS", expect.any(Object));
    expect(signalService.getSignal).toHaveBeenNthCalledWith(3, "NSE:RELIANCE", expect.any(Object));
    expect(result).toMatchObject({
      scannedCount: 3,
      requestedCount: 3,
      matches: [
        {
          symbol: "NSE:INFY",
          signal: "INTRADAY_LONG",
          signal_type: "INTRADAY_LONG",
          ltp: 1500,
          indicators: { rsi: 61 },
        },
        {
          symbol: "NSE:RELIANCE",
          signal: "INTRADAY_SHORT",
          signal_type: "INTRADAY_SHORT",
          ltp: 2500,
          indicators: { rsi: 35 },
        },
      ],
      failures: [],
      aborted: false,
    });
    expect(result.durationMs).toEqual(expect.any(Number));
    expect(signalLogger.logSignal).toHaveBeenCalledTimes(2);
    expect(signalLogger.logSignal).toHaveBeenNthCalledWith(1, result.matches[0]);
    expect(signalLogger.logSignal).toHaveBeenNthCalledWith(2, result.matches[1]);
    expect(discordNotifier.logSignal).toHaveBeenCalledTimes(2);
    expect(discordNotifier.logSignal).toHaveBeenNthCalledWith(1, result.matches[0]);
    expect(discordNotifier.logSignal).toHaveBeenNthCalledWith(2, result.matches[1]);
  });

  it("continues scanning when Discord notification fails", async () => {
    const signalService = {
      getSignal: jest.fn().mockResolvedValue({
        symbol: "NSE:INFY",
        signal: "INTRADAY_LONG",
        signal_type: "INTRADAY_LONG",
        ltp: 1500,
        indicators: { rsi: 61 },
      }),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const discordNotifier = {
      logSignal: jest.fn().mockRejectedValue(new Error("Discord unavailable")),
    };
    const scannerService = createScannerService({
      signalService,
      discordNotifier,
      logger,
      symbols: ["INFY"],
    });

    const result = await scannerService.scanMarket();

    expect(result.matches).toHaveLength(1);
    expect(result.failures).toEqual([]);
    expect(result.aborted).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "NSE:INFY",
        error: "Discord unavailable",
      }),
      "Failed to send Discord trading signal",
    );
  });

  it("scans portfolio symbols and enriches actionable signals with position context", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "NO_TRADE",
          ltp: 1500,
        })
        .mockResolvedValueOnce({
          symbol: "NSE:KAYNES",
          signal: "INTRADAY_LONG",
          signal_type: "INTRADAY_LONG",
          ltp: 4500,
        }),
    };
    const portfolioContextService = {
      prepareScan: jest.fn().mockResolvedValue({ symbols: ["INFY", "KAYNES"] }),
      getPositionContext: jest.fn().mockReturnValue({
        has_position: true,
        source: "local_json",
      }),
    };
    const scannerService = createScannerService({
      signalService,
      portfolioContextService,
      symbols: ["INFY"],
    });

    const result = await scannerService.scanMarket();

    expect(portfolioContextService.prepareScan).toHaveBeenCalledWith({ baseSymbols: ["INFY"] });
    expect(signalService.getSignal).toHaveBeenNthCalledWith(2, "NSE:KAYNES", expect.any(Object));
    expect(result.requestedCount).toBe(2);
    expect(result.matches).toEqual([
      expect.objectContaining({
        symbol: "NSE:KAYNES",
        position_context: {
          has_position: true,
          source: "local_json",
        },
      }),
    ]);
  });

  it("continues scanning when one stock fails", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "INTRADAY_LONG",
          ltp: 1500,
          indicators: { rsi: 61 },
        })
        .mockRejectedValueOnce(new Error("Temporary upstream error"))
        .mockResolvedValueOnce({
          symbol: "NSE:RELIANCE",
          signal: "INTRADAY_SHORT",
          ltp: 2500,
          indicators: { rsi: 35 },
        }),
    };

    const scannerService = createScannerService({
      signalService,
      symbols: ["INFY", "TCS", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();
    logTestCase(
      "scannerService: continues on non-fatal error",
      { symbols: ["INFY", "TCS", "RELIANCE"] },
      result,
    );

    expect(result.scannedCount).toBe(3);
    expect(result.requestedCount).toBe(3);
    expect(result.matches).toHaveLength(2);
    expect(result.failures).toEqual([
      expect.objectContaining({
        symbol: "NSE:TCS",
        error: "Temporary upstream error",
      }),
    ]);
    expect(result.aborted).toBe(false);
  });

  it("treats insufficient data as a non-failure and continues the scan", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "NO_TRADE",
          reason: "INSUFFICIENT_DATA",
          ltp: 1500,
          indicators: null,
          meta: {
            receivedCandles: 22,
            requiredCandles: 50,
          },
        })
        .mockResolvedValueOnce({
          symbol: "NSE:RELIANCE",
          signal: "INTRADAY_SHORT",
          ltp: 2500,
          indicators: { rsi: 35 },
        }),
    };

    const scannerService = createScannerService({
      signalService,
      symbols: ["INFY", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();
    logTestCase(
      "scannerService: ignores insufficient data",
      { symbols: ["INFY", "RELIANCE"] },
      result,
    );

    expect(result).toMatchObject({
      scannedCount: 2,
      requestedCount: 2,
      matches: [
        {
          symbol: "NSE:RELIANCE",
          signal: "INTRADAY_SHORT",
          ltp: 2500,
          indicators: { rsi: 35 },
        },
      ],
      failures: [],
      aborted: false,
    });
  });

  it("continues even when multiple symbols return insufficient data", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "NO_TRADE",
          reason: "INSUFFICIENT_DATA",
          ltp: 1500,
          indicators: null,
          meta: {
            receivedCandles: 18,
            requiredCandles: 50,
          },
        })
        .mockResolvedValueOnce({
          symbol: "NSE:TCS",
          signal: "NO_TRADE",
          reason: "INSUFFICIENT_DATA",
          ltp: 3900,
          indicators: null,
          meta: {
            receivedCandles: 24,
            requiredCandles: 50,
          },
        })
        .mockResolvedValueOnce({
          symbol: "NSE:RELIANCE",
          signal: "INTRADAY_LONG",
          ltp: 2500,
          indicators: { rsi: 61 },
        }),
    };

    const scannerService = createScannerService({
      signalService,
      symbols: ["INFY", "TCS", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();
    logTestCase(
      "scannerService: multiple insufficient data responses",
      { symbols: ["INFY", "TCS", "RELIANCE"] },
      result,
    );

    expect(result.scannedCount).toBe(3);
    expect(result.failures).toEqual([]);
    expect(result.matches).toEqual([
      expect.objectContaining({
        symbol: "NSE:RELIANCE",
        signal: "INTRADAY_LONG",
        ltp: 2500,
        indicators: { rsi: 61 },
      }),
    ]);
    expect(result.aborted).toBe(false);
  });

  it("aborts early on fatal auth or configuration failures", async () => {
    const signalService = {
      getSignal: jest.fn().mockRejectedValue(new Error("Failed to fetch LTP: Invalid session")),
    };

    const scannerService = createScannerService({
      signalService,
      symbols: ["INFY", "TCS", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();
    logTestCase(
      "scannerService: aborts on fatal failure",
      { symbols: ["INFY", "TCS", "RELIANCE"] },
      result,
    );

    expect(signalService.getSignal).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      scannedCount: 1,
      requestedCount: 3,
      matches: [],
      failures: [
        {
          symbol: "NSE:INFY",
          error: "Failed to fetch LTP: Invalid session",
        },
      ],
      aborted: true,
    });
  });

  it("classifies invalid-session errors as fatal", () => {
    expect(isFatalScanError(new Error("Failed to fetch LTP: Invalid session"))).toBe(true);
    expect(isFatalScanError(new Error("Failed to compute indicators"))).toBe(false);
  });
});
