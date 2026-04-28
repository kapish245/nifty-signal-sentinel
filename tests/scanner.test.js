const { createScannerService } = require("../src/scanner/scannerService");

describe("scannerService", () => {
  it("scans multiple stocks and returns only HOLD and SELL signals", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "HOLD",
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
          signal: "SELL",
          ltp: 2500,
          indicators: { rsi: 35 },
        }),
    };
    const signalLogger = {
      logSignal: jest.fn().mockResolvedValue(undefined),
    };

    const scannerService = createScannerService({
      signalService,
      signalLogger,
      symbols: ["INFY", "TCS", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();

    expect(signalService.getSignal).toHaveBeenNthCalledWith(1, "NSE:INFY");
    expect(signalService.getSignal).toHaveBeenNthCalledWith(2, "NSE:TCS");
    expect(signalService.getSignal).toHaveBeenNthCalledWith(3, "NSE:RELIANCE");
    expect(result).toEqual({
      scannedCount: 3,
      matches: [
        {
          symbol: "NSE:INFY",
          signal: "HOLD",
          ltp: 1500,
          indicators: { rsi: 61 },
        },
        {
          symbol: "NSE:RELIANCE",
          signal: "SELL",
          ltp: 2500,
          indicators: { rsi: 35 },
        },
      ],
      failures: [],
    });
    expect(signalLogger.logSignal).toHaveBeenCalledTimes(2);
    expect(signalLogger.logSignal).toHaveBeenNthCalledWith(1, result.matches[0]);
    expect(signalLogger.logSignal).toHaveBeenNthCalledWith(2, result.matches[1]);
  });

  it("continues scanning when one stock fails", async () => {
    const signalService = {
      getSignal: jest
        .fn()
        .mockResolvedValueOnce({
          symbol: "NSE:INFY",
          signal: "HOLD",
          ltp: 1500,
          indicators: { rsi: 61 },
        })
        .mockRejectedValueOnce(new Error("Invalid session for symbol"))
        .mockResolvedValueOnce({
          symbol: "NSE:RELIANCE",
          signal: "SELL",
          ltp: 2500,
          indicators: { rsi: 35 },
        }),
    };

    const scannerService = createScannerService({
      signalService,
      symbols: ["INFY", "TCS", "RELIANCE"],
    });

    const result = await scannerService.scanMarket();

    expect(result.scannedCount).toBe(3);
    expect(result.matches).toHaveLength(2);
    expect(result.failures).toEqual([
      {
        symbol: "NSE:TCS",
        error: "Invalid session for symbol",
      },
    ]);
  });
});
