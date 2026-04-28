const { createSignalService } = require("../src/services/signalService");

describe("signalService", () => {
  it("fetches market data, computes indicators, and returns a signal payload", async () => {
    const kiteClient = {
      getLTP: jest.fn().mockResolvedValue({
        symbol: "NSE:INFY",
        instrumentToken: 408065,
        lastPrice: 1580,
      }),
    };
    const historicalClient = {
      getHistoricalCandles: jest.fn().mockResolvedValue([
        { timestamp: "2026-04-28T09:15:00+05:30", open: 1400, high: 1402, low: 1398, close: 1400, volume: 100 },
        { timestamp: "2026-04-28T09:20:00+05:30", open: 1400, high: 1404, low: 1399, close: 1403, volume: 110 },
        { timestamp: "2026-04-28T09:25:00+05:30", open: 1403, high: 1406, low: 1402, close: 1405, volume: 120 },
        { timestamp: "2026-04-28T09:30:00+05:30", open: 1405, high: 1409, low: 1404, close: 1408, volume: 150 },
        { timestamp: "2026-04-28T09:35:00+05:30", open: 1408, high: 1413, low: 1407, close: 1412, volume: 170 },
        { timestamp: "2026-04-28T09:40:00+05:30", open: 1412, high: 1417, low: 1410, close: 1416, volume: 190 },
        { timestamp: "2026-04-28T09:45:00+05:30", open: 1416, high: 1420, low: 1415, close: 1419, volume: 210 },
        { timestamp: "2026-04-28T09:50:00+05:30", open: 1419, high: 1423, low: 1418, close: 1422, volume: 230 },
        { timestamp: "2026-04-28T09:55:00+05:30", open: 1422, high: 1427, low: 1421, close: 1426, volume: 250 },
        { timestamp: "2026-04-28T10:00:00+05:30", open: 1426, high: 1430, low: 1425, close: 1429, volume: 270 },
        { timestamp: "2026-04-28T10:05:00+05:30", open: 1429, high: 1434, low: 1428, close: 1433, volume: 290 },
        { timestamp: "2026-04-28T10:10:00+05:30", open: 1433, high: 1438, low: 1432, close: 1437, volume: 310 },
        { timestamp: "2026-04-28T10:15:00+05:30", open: 1437, high: 1440, low: 1435, close: 1439, volume: 330 },
        { timestamp: "2026-04-28T10:20:00+05:30", open: 1439, high: 1444, low: 1438, close: 1443, volume: 350 },
        { timestamp: "2026-04-28T10:25:00+05:30", open: 1443, high: 1448, low: 1441, close: 1447, volume: 370 },
        { timestamp: "2026-04-28T10:30:00+05:30", open: 1447, high: 1451, low: 1445, close: 1450, volume: 390 },
        { timestamp: "2026-04-28T10:35:00+05:30", open: 1450, high: 1454, low: 1448, close: 1453, volume: 410 },
        { timestamp: "2026-04-28T10:40:00+05:30", open: 1453, high: 1458, low: 1452, close: 1457, volume: 430 },
        { timestamp: "2026-04-28T10:45:00+05:30", open: 1457, high: 1462, low: 1456, close: 1461, volume: 450 },
        { timestamp: "2026-04-28T10:50:00+05:30", open: 1461, high: 1465, low: 1459, close: 1464, volume: 470 },
        { timestamp: "2026-04-28T10:55:00+05:30", open: 1464, high: 1468, low: 1462, close: 1467, volume: 490 },
        { timestamp: "2026-04-28T11:00:00+05:30", open: 1467, high: 1472, low: 1466, close: 1471, volume: 510 },
        { timestamp: "2026-04-28T11:05:00+05:30", open: 1471, high: 1476, low: 1470, close: 1475, volume: 530 },
        { timestamp: "2026-04-28T11:10:00+05:30", open: 1475, high: 1480, low: 1474, close: 1479, volume: 550 },
        { timestamp: "2026-04-28T11:15:00+05:30", open: 1479, high: 1483, low: 1477, close: 1482, volume: 570 },
        { timestamp: "2026-04-28T11:20:00+05:30", open: 1482, high: 1487, low: 1481, close: 1486, volume: 590 },
        { timestamp: "2026-04-28T11:25:00+05:30", open: 1486, high: 1490, low: 1484, close: 1489, volume: 610 },
        { timestamp: "2026-04-28T11:30:00+05:30", open: 1489, high: 1494, low: 1488, close: 1493, volume: 630 },
        { timestamp: "2026-04-28T11:35:00+05:30", open: 1493, high: 1498, low: 1492, close: 1497, volume: 650 },
        { timestamp: "2026-04-28T11:40:00+05:30", open: 1497, high: 1501, low: 1495, close: 1500, volume: 670 },
        { timestamp: "2026-04-28T11:45:00+05:30", open: 1500, high: 1505, low: 1499, close: 1504, volume: 690 },
        { timestamp: "2026-04-28T11:50:00+05:30", open: 1504, high: 1509, low: 1503, close: 1508, volume: 710 },
        { timestamp: "2026-04-28T11:55:00+05:30", open: 1508, high: 1512, low: 1506, close: 1511, volume: 730 },
        { timestamp: "2026-04-28T12:00:00+05:30", open: 1511, high: 1516, low: 1510, close: 1515, volume: 750 },
        { timestamp: "2026-04-28T12:05:00+05:30", open: 1515, high: 1519, low: 1513, close: 1518, volume: 770 },
        { timestamp: "2026-04-28T12:10:00+05:30", open: 1518, high: 1523, low: 1517, close: 1522, volume: 790 },
        { timestamp: "2026-04-28T12:15:00+05:30", open: 1522, high: 1527, low: 1521, close: 1526, volume: 810 },
        { timestamp: "2026-04-28T12:20:00+05:30", open: 1526, high: 1530, low: 1524, close: 1529, volume: 830 },
        { timestamp: "2026-04-28T12:25:00+05:30", open: 1529, high: 1534, low: 1528, close: 1533, volume: 850 },
        { timestamp: "2026-04-28T12:30:00+05:30", open: 1533, high: 1538, low: 1532, close: 1537, volume: 870 },
        { timestamp: "2026-04-28T12:35:00+05:30", open: 1537, high: 1541, low: 1535, close: 1540, volume: 890 },
        { timestamp: "2026-04-28T12:40:00+05:30", open: 1540, high: 1545, low: 1539, close: 1544, volume: 910 },
        { timestamp: "2026-04-28T12:45:00+05:30", open: 1544, high: 1549, low: 1543, close: 1548, volume: 930 },
        { timestamp: "2026-04-28T12:50:00+05:30", open: 1548, high: 1552, low: 1546, close: 1551, volume: 950 },
        { timestamp: "2026-04-28T12:55:00+05:30", open: 1551, high: 1556, low: 1550, close: 1555, volume: 970 },
        { timestamp: "2026-04-28T13:00:00+05:30", open: 1555, high: 1560, low: 1554, close: 1559, volume: 990 },
        { timestamp: "2026-04-28T13:05:00+05:30", open: 1559, high: 1563, low: 1557, close: 1562, volume: 1010 },
        { timestamp: "2026-04-28T13:10:00+05:30", open: 1562, high: 1567, low: 1561, close: 1566, volume: 1030 },
        { timestamp: "2026-04-28T13:15:00+05:30", open: 1566, high: 1571, low: 1565, close: 1570, volume: 1050 },
        { timestamp: "2026-04-28T13:20:00+05:30", open: 1570, high: 1574, low: 1568, close: 1573, volume: 1070 },
        { timestamp: "2026-04-28T13:25:00+05:30", open: 1573, high: 1578, low: 1572, close: 1577, volume: 1090 },
      ]),
    };

    const service = createSignalService({
      kiteClient,
      historicalClient,
    });

    const result = await service.getSignal("NSE:INFY");

    expect(result).toEqual({
      symbol: "NSE:INFY",
      ltp: 1580,
      indicators: expect.objectContaining({
        priceTrend: "up",
        emaAlignment: "bullish",
        volume: "increasing",
        oiSignal: "long_buildup",
      }),
      signal: "HOLD",
    });
    expect(result.indicators.rsi).toEqual(expect.any(Number));
    expect(result.indicators.rsi).toBeGreaterThan(55);

    expect(kiteClient.getLTP).toHaveBeenCalledWith("NSE:INFY");
    expect(historicalClient.getHistoricalCandles).toHaveBeenCalledWith(
      "NSE:INFY",
      "5minute",
      250,
      { instrumentToken: 408065 },
    );
  });

  it("fails clearly when indicator provider returns an invalid payload", async () => {
    const service = createSignalService({
      kiteClient: {
        getLTP: jest.fn().mockResolvedValue({
          symbol: "NSE:INFY",
          lastPrice: 1520.4,
        }),
      },
      indicatorProvider: () => null,
    });

    await expect(service.getSignal("NSE:INFY")).rejects.toThrow(
      "Failed to compute indicators: Indicator provider must return an object",
    );
  });
});
