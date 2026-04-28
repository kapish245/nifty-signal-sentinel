# Nifty Signal Sentinel

Nifty Signal Sentinel is a production-oriented Node.js trading scanner built on Zerodha Kite Connect. It currently covers authentication, automatic local token capture for development, token persistence, LTP and historical candle access, indicator-driven signal generation, Nifty 50 market scanning, scheduler-based execution, rate-limit-safe API access, and structured signal logging.

The scanner is designed to fail safe when Zerodha historical data is incomplete. If the API returns too few candles for indicator computation, the system returns a safe `NO_TRADE` result instead of crashing.

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
- Automatic `.env` request-token and access-token updates for local development
- Real LTP fetches
- Historical candle fetches
- Indicator engine for RSI, EMA, volume, and trend
- Signal engine for `HOLD`, `SELL`, and `NO_TRADE`
- Defensive insufficient-data handling for variable historical candle responses
- Nifty 50 scanning with meaningful-signal filtering
- Scheduler-based execution during market hours
- Rate limiting to stay within Zerodha API limits
- Structured JSON logging for actionable signals

## Current Status

Development completed so far:

- Zerodha auth flow is implemented and tested
- Automatic `.env` token update flow is implemented for local development
- Access token exchange and local persistence are implemented
- LTP and historical data clients are implemented
- Indicator engine is implemented with real market-data inputs
- Signal service is wired to real indicators
- Signal generation now degrades safely to `NO_TRADE` when candle history is insufficient
- Nifty 50 scanner is implemented
- Scheduler is implemented for recurring scans during market hours
- Rate limiter is implemented and integrated into quote and historical clients
- Signal logger is implemented for daily JSON logs
- Jest test suite is passing

## Features

- Production-style module separation for auth, data access, indicators, signals, scanning, scheduling, and logging
- Nifty 50 universe scan with per-symbol fault tolerance
- Filtering that logs only `HOLD` and `SELL`
- Safe handling for Zerodha historical candle count inconsistencies
- Queue-based API throttling to avoid burst requests
- Market-hours-only scheduler using `setInterval`
- JSON log files written per trading day
- Development auth scripts for login URL generation and auto token capture
- CLI entry points for one-time scans and scheduled scanning
- Test coverage for auth, indicators, signal engine, signal service, scanner behavior, rate limiting, and guarded live Zerodha integrations

## Architecture

Core flow:

1. Zerodha session is created and access token is persisted
2. Optional development flow updates `.env` automatically after callback exchange
3. `runner.js` loads the access token and builds runtime services
4. `scannerService` scans the configured Nifty 50 universe
5. `signalService` fetches LTP and historical candles for each symbol
6. If historical candles are insufficient, a safe `NO_TRADE` response is returned
7. Otherwise indicators are computed and passed to the signal engine
8. Only meaningful signals are printed and logged
9. Scheduler repeats the process during market hours

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
│   ├── scripts
│   │   └── printLoginUrl.js
│   └── utils
│       ├── checksum.js
│       ├── envFile.js
│       └── rateLimiter.js
└── tests
    ├── api.test.js
    ├── auth.test.js
    ├── envFile.test.js
    ├── indicators.test.js
    ├── liveMarketData.test.js
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
ZERODHA_AUTO_UPDATE_ENV_ON_CALLBACK=false
ZERODHA_ENV_PATH=.env
RUN_LIVE_KITE_TESTS=false
ZERODHA_REQUEST_TOKEN=
ZERODHA_ACCESS_TOKEN=
SCANNER_INTERVAL_MS=120000
```

Notes:

- `ZERODHA_ACCESS_TOKEN` is optional if you already persist the session to `ZERODHA_TOKEN_PATH`
- `ZERODHA_AUTO_UPDATE_ENV_ON_CALLBACK` enables automatic local `.env` updates after callback handling
- `ZERODHA_ENV_PATH` lets you override which env file is updated during local development
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
npm run auth:url
```

5. Log in with Zerodha and capture the `request_token`

6. Exchange the request token for an access token:

```bash
node -e "require('dotenv').config(); const { exchangeRequestToken } = require('./src/auth/token'); exchangeRequestToken({ apiKey: process.env.ZERODHA_API_KEY, apiSecret: process.env.ZERODHA_API_SECRET, requestToken: process.env.ZERODHA_REQUEST_TOKEN, tokenPath: process.env.ZERODHA_TOKEN_PATH }).then((result) => console.log({ accessToken: result.accessToken, publicToken: result.publicToken })).catch((error) => { console.error(error.message); process.exit(1); });"
```

## Development Auth Flow

To automate local token handling during development:

1. Start the auto callback server:

```bash
npm run auth:auto
```

2. In another terminal, print the login URL:

```bash
npm run auth:url
```

3. Open the URL in your browser and complete the Zerodha login flow

After the callback returns to `http://localhost:3000`, the app will:

- capture `ZERODHA_REQUEST_TOKEN`
- exchange it for `ZERODHA_ACCESS_TOKEN`
- update your local `.env`
- persist the session to `ZERODHA_TOKEN_PATH`

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
- uses a 600-minute lookback for `5minute` candles to improve candle availability
- returns `NO_TRADE` with reason `INSUFFICIENT_DATA` when fewer than 50 candles are available
- logs only `HOLD` and `SELL`
- skips `NO_TRADE`
- scans only during `09:15` to `15:30` IST on weekdays
- continues scanning even if one symbol fails

## Logging

Observability is now split into three outputs:

```text
logs/system/YYYY-MM-DD.log
logs/YYYY-MM-DD.json
logs/obsidian/YYYY-MM-DD.md
```

1) Structured execution logs (`logs/system/YYYY-MM-DD.log`):

```json
{
  "timestamp": "2026-04-28T09:30:00.000Z",
  "level": "info",
  "module": "services:signal",
  "message": "Signal decision completed",
  "data": {
    "symbol": "NSE:INFY",
    "ltp": 1580,
    "signal": "HOLD",
    "reason": "Bullish continuation: trend up, EMA bullish, RSI healthy, volume/oi supportive",
    "indicators": {
      "priceTrend": "up",
      "emaAlignment": "bullish",
      "rsi": 61.2,
      "volume": "increasing",
      "oiSignal": "long_buildup"
    }
  }
}
```

2) Signal archive (`logs/YYYY-MM-DD.json`):

- Maintains per-day JSON array of persisted `HOLD` and `SELL` signal payloads.

3) Obsidian markdown notes (`logs/obsidian/YYYY-MM-DD.md`):

```md
## Time: 09:30

### Symbol: INFY

* Signal: HOLD
* Price: 1580
* RSI: 61.2
* Trend: bullish
* Reason: strong continuation
```

### Logger controls

Set these in `.env`:

```env
LOG_LEVEL=info
ENABLE_DEBUG_LOGS=true
ENABLE_OBSIDIAN_LOG=true
```

- `LOG_LEVEL`: minimum level emitted (`debug`, `info`, `warn`, `error`)
- `ENABLE_DEBUG_LOGS=false`: hard-disables debug traces even if `LOG_LEVEL=debug`
- `ENABLE_OBSIDIAN_LOG=false`: disables markdown note generation

### Access token source precedence

Scanner runtime resolves token in this order:

1. persisted token file (`ZERODHA_TOKEN_PATH`, default `./tmp/kite-session.json`)
2. `ZERODHA_ACCESS_TOKEN` from `.env`

If both exist and differ, persisted token is preferred and a warning is logged.

### What gets traced

- scanner lifecycle: start, per-symbol processing, failures, summary, duration
- scheduler lifecycle: start, skipped runs, trigger, completion duration
- signal decisions: full decision payload with `symbol`, `ltp`, `indicators`, `signal`, `reason`
- indicator debug traces: RSI/EMA input-output and candle counts (debug level only)
- tests: each core test logs input/output via `logTestCase(...)`

### Test execution logs

Structured test logs are written to:

```text
logs/tests/day/YYYY-MM-DD.log
```

Each line is a JSON entry with test name, input, and output payload.  
Set `TEST_LOG_CONSOLE=false` to disable console mirroring during `npm test`.

### Production triage commands

Tail recent structured logs:

```bash
tail -n 50 logs/system/$(date +%F).log
```

Filter scanner errors:

```bash
jq -c 'select(.module=="scanner:service" and .level=="error")' logs/system/$(date +%F).log
```

Filter one symbol across all modules:

```bash
jq -c 'select(.data.symbol=="NSE:INFY")' logs/system/$(date +%F).log
```

Show scheduler duration entries:

```bash
jq -c 'select(.module=="scheduler" and (.message|test("Completed scheduled market scan")))' logs/system/$(date +%F).log
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
- live LTP fetch for a real stock when enabled
- live historical candle fetch for a real stock when enabled
- live scanner subset verification when enabled

Live signal behavior:

- live tests accept `NO_TRADE` when Zerodha returns insufficient historical candles
- insufficient candle responses should not crash the signal service or abort the full scan

## Security Notes

- API secrets are loaded from environment variables only
- API keys and secrets are not written to logs by the application
- Access tokens are persisted locally only when you explicitly configure token storage
- The development auth automation updates your local `.env`, so keep that file out of version control
- Do not commit `.env`, token files, or logs containing live trading metadata

## Known Constraints

- Quote calls should stay around `1 request/sec`
- Historical calls should stay around `2-3 requests/sec`
- Zerodha historical API uses date ranges and does not guarantee a fixed candle count
- Observability is still limited because only actionable signals are persisted to disk today
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
