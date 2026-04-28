# Nifty Signal Sentinel

Nifty Signal Sentinel is a production-oriented Node.js trading scanner built on Zerodha Kite Connect. It currently covers authentication, token persistence, LTP and historical candle access, indicator-driven signal generation, Nifty 50 market scanning, scheduler-based execution, rate-limit-safe API access, and structured signal logging.

## Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Logging](#logging)
- [Testing](#testing)
- [Security Notes](#security-notes)
- [Known Constraints](#known-constraints)
- [Roadmap](#roadmap)

## Overview

The application is designed as a stable backend foundation for a rules-based trading workflow. The current implementation focuses on reliability over speed:

- Zerodha login and request-token exchange
- Access-token persistence and reload
- Real LTP fetches
- Historical candle fetches
- Indicator engine for RSI, EMA, volume, and trend
- Signal engine for `HOLD`, `SELL`, and `NO_TRADE`
- Nifty 50 scanning with meaningful-signal filtering
- Scheduler-based execution during market hours
- Rate limiting to stay within Zerodha API limits
- Structured JSON logging for actionable signals

## Current Status

Development completed so far:

- Zerodha auth flow is implemented and tested
- Access token exchange and local persistence are implemented
- LTP and historical data clients are implemented
- Indicator engine is implemented with real market-data inputs
- Signal service is wired to real indicators
- Nifty 50 scanner is implemented
- Scheduler is implemented for recurring scans during market hours
- Rate limiter is implemented and integrated into quote and historical clients
- Signal logger is implemented for daily JSON logs
- Jest test suite is passing

## Features

- Production-style module separation for auth, data access, indicators, signals, scanning, scheduling, and logging
- Nifty 50 universe scan with per-symbol fault tolerance
- Filtering that logs only `HOLD` and `SELL`
- Queue-based API throttling to avoid burst requests
- Market-hours-only scheduler using `setInterval`
- JSON log files written per trading day
- CLI entry points for one-time scans and scheduled scanning
- Test coverage for auth, indicators, signal engine, signal service, scanner behavior, and rate limiting

## Architecture

Core flow:

1. Zerodha session is created and access token is persisted
2. `runner.js` loads the access token and builds runtime services
3. `scannerService` scans the configured Nifty 50 universe
4. `signalService` fetches LTP and historical candles for each symbol
5. Indicators are computed and passed to the signal engine
6. Only meaningful signals are printed and logged
7. Scheduler repeats the process during market hours

## Project Structure

```text
.
├── logs/
├── package.json
├── package-lock.json
├── README.md
├── src
│   ├── app.js
│   ├── runner.js
│   ├── auth
│   │   ├── login.js
│   │   └── token.js
│   ├── config
│   │   └── nifty50.js
│   ├── data
│   │   ├── kiteClient.js
│   │   └── kiteHistorical.js
│   ├── indicators
│   │   ├── ema.js
│   │   ├── rsi.js
│   │   ├── trend.js
│   │   └── volume.js
│   ├── logger
│   │   └── signalLogger.js
│   ├── scanner
│   │   └── scannerService.js
│   ├── scheduler
│   │   └── scheduler.js
│   ├── services
│   │   └── signalService.js
│   ├── signals
│   │   └── signalEngine.js
│   └── utils
│       ├── checksum.js
│       └── rateLimiter.js
└── tests
    ├── api.test.js
    ├── auth.test.js
    ├── indicators.test.js
    ├── rateLimiter.test.js
    ├── scanner.test.js
    ├── signalEngine.test.js
    ├── signalService.test.js
    └── trend.test.js
```

## Requirements

- Node.js `>=20`
- Zerodha Kite Connect API credentials
- A valid access token generated from the Zerodha login flow

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
ZERODHA_API_KEY=your_zerodha_api_key
ZERODHA_API_SECRET=your_zerodha_api_secret
ZERODHA_TOKEN_PATH=./tmp/kite-session.json
ZERODHA_AUTO_EXCHANGE_ON_CALLBACK=false
RUN_LIVE_KITE_TESTS=false
ZERODHA_REQUEST_TOKEN=
ZERODHA_ACCESS_TOKEN=
SCANNER_INTERVAL_MS=120000
```

Notes:

- `ZERODHA_ACCESS_TOKEN` is optional if you already persist the session to `ZERODHA_TOKEN_PATH`
- `SCANNER_INTERVAL_MS` defaults to `120000` milliseconds if omitted

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the test suite:

```bash
npm test
```

3. Start the callback server:

```bash
npm start
```

4. Generate the Zerodha login URL:

```bash
node -e "require('dotenv').config(); const { generateLoginUrl } = require('./src/auth/login'); console.log(generateLoginUrl(process.env.ZERODHA_API_KEY));"
```

5. Log in with Zerodha and capture the `request_token`

6. Exchange the request token for an access token:

```bash
node -e "require('dotenv').config(); const { exchangeRequestToken } = require('./src/auth/token'); exchangeRequestToken({ apiKey: process.env.ZERODHA_API_KEY, apiSecret: process.env.ZERODHA_API_SECRET, requestToken: process.env.ZERODHA_REQUEST_TOKEN, tokenPath: process.env.ZERODHA_TOKEN_PATH }).then((result) => console.log({ accessToken: result.accessToken, publicToken: result.publicToken })).catch((error) => { console.error(error.message); process.exit(1); });"
```

## Usage

Run one market scan:

```bash
npm run scanner:once
```

Start the recurring scheduler:

```bash
npm run scanner:scheduler
```

Run the scheduler every 3 minutes instead of the default 2:

```bash
SCANNER_INTERVAL_MS=180000 npm run scanner:scheduler
```

Behavior:

- scans the full configured Nifty 50 universe
- fetches LTP and historical candles sequentially through rate-limited clients
- computes real indicators
- logs only `HOLD` and `SELL`
- skips `NO_TRADE`
- scans only during `09:15` to `15:30` IST on weekdays
- continues scanning even if one symbol fails

## Logging

Signals are stored in:

```text
logs/YYYY-MM-DD.json
```

Each log entry contains:

```json
{
  "timestamp": "2026-04-28T09:30:00.000Z",
  "symbol": "NSE:INFY",
  "signal": "HOLD",
  "ltp": 1580,
  "indicators": {
    "priceTrend": "up",
    "emaAlignment": "bullish",
    "rsi": 61.2,
    "volume": "increasing",
    "oiSignal": "long_buildup"
  }
}
```

## Testing

Run all tests:

```bash
npm test
```

Run live Zerodha API validation only when you intentionally want it:

```bash
npm run test:live
```

The suite currently covers:

- auth flow
- session exchange and token persistence
- Kite LTP client
- Kite historical candle client
- indicator calculations
- signal engine logic
- signal service integration
- scanner filtering behavior
- rate limiter behavior

## Security Notes

- API secrets are loaded from environment variables only
- API keys and secrets are not written to logs by the application
- Access tokens are persisted locally only when you explicitly configure token storage
- Do not commit `.env`, token files, or logs containing live trading metadata

## Known Constraints

- Quote calls should stay around `1 request/sec`
- Historical calls should stay around `2-3 requests/sec`
- The application currently uses REST polling only
- WebSockets are not implemented yet
- OI-specific strategy logic is not implemented yet
- Market holidays are not explicitly checked yet; only weekday and market-hour windows are enforced

## Roadmap

- add instrument-master-aware symbol validation for live exchange symbols
- add holiday-calendar awareness
- add richer structured app logging for scheduler runs and failures
- add signal ranking or prioritization
- add persistence for scan summaries
- add deployment and process-manager setup for long-running execution
