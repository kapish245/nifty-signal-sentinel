const {
  createKiteDerivativesClient,
  normalizeUnderlyingSymbol,
  parseInstrumentCsv,
  selectOptionInstruments,
} = require("../src/data/kiteDerivatives");

const HEADER = [
  "instrument_token",
  "exchange_token",
  "tradingsymbol",
  "name",
  "last_price",
  "expiry",
  "strike",
  "tick_size",
  "lot_size",
  "instrument_type",
  "segment",
  "exchange",
].join(",");
const INSTRUMENT_CSV = [
  HEADER,
  "1,11,INFY26MAY1480CE,INFY,0,2026-05-28,1480,0.05,400,CE,NFO-OPT,NFO",
  "2,12,INFY26MAY1480PE,INFY,0,2026-05-28,1480,0.05,400,PE,NFO-OPT,NFO",
  "3,13,INFY26MAY1500CE,INFY,0,2026-05-28,1500,0.05,400,CE,NFO-OPT,NFO",
  "4,14,INFY26MAY1500PE,INFY,0,2026-05-28,1500,0.05,400,PE,NFO-OPT,NFO",
].join("\n");

describe("kiteDerivatives", () => {
  it("parses NFO instrument CSV and selects nearby option contracts", () => {
    const instruments = parseInstrumentCsv(INSTRUMENT_CSV);
    const selected = selectOptionInstruments({
      instruments,
      underlying: "INFY",
      spotPrice: 1495,
      maxStrikes: 2,
    });

    expect(selected.map((instrument) => instrument.tradingsymbol)).toEqual([
      "INFY26MAY1480CE",
      "INFY26MAY1480PE",
      "INFY26MAY1500CE",
      "INFY26MAY1500PE",
    ]);
  });

  it("normalizes equity symbols to derivatives underlyings", () => {
    expect(normalizeUnderlyingSymbol("NSE:INFY-EQ")).toBe("INFY");
  });

  it("builds option chain with quote snapshots", async () => {
    const httpClient = {
      get: jest.fn()
        .mockResolvedValueOnce({ data: INSTRUMENT_CSV })
        .mockResolvedValueOnce({
          data: {
            data: {
              "NFO:INFY26MAY1480CE": { last_price: 40, volume: 100, oi: 600, ohlc: { close: 35 } },
              "NFO:INFY26MAY1480PE": { last_price: 25, volume: 120, oi: 900, ohlc: { close: 30 } },
              "NFO:INFY26MAY1500CE": { last_price: 30, volume: 110, oi: 700, ohlc: { close: 28 } },
              "NFO:INFY26MAY1500PE": { last_price: 35, volume: 130, oi: 1200, ohlc: { close: 32 } },
            },
          },
        }),
    };
    const client = createKiteDerivativesClient({
      apiKey: "api_key",
      accessToken: "access_token",
      httpClient,
      nowProvider: () => new Date("2026-04-30T09:30:00.000Z"),
    });

    const result = await client.getOptionChain({
      symbol: "NSE:INFY",
      spotPrice: 1495,
      maxStrikes: 2,
    });

    expect(result).toEqual(
      expect.objectContaining({
        underlying: "INFY",
        expiry: "2026-05-28",
        contracts: expect.arrayContaining([
          expect.objectContaining({
            symbol: "NFO:INFY26MAY1500PE",
            oi: 1200,
            priceChange: 3,
          }),
        ]),
      }),
    );
  });
});
