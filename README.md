# Nifty Signal Sentinel

Nifty Signal Sentinel is a production-oriented Node.js intraday trading scanner built on Zerodha Kite Connect. It currently covers authentication, automatic local token capture for development, token persistence, LTP and historical candle access, market-mode-aware candle policy, multi-timeframe technical analysis, derivatives/OI confirmation, Nifty 50 market scanning, scheduler-based execution, rate-limit-safe API access, correlation IDs, file-based data boundaries, and structured signal logging.

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
- Indicator engine for RSI, EMA, volume, trend, VWAP, ATR, and MACD
- Price-action context for support/resistance, breakout/breakdown, and multi-timeframe bias
- Derivatives/OI context for PCR, max pain, OI support/resistance, and signal confirmation
- Signal engine output mapped to intraday contracts: `INTRADAY_LONG`, `INTRADAY_SHORT`, and `NO_TRADE`
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
- Phase 4 technical engine is implemented for `minute`, `5minute`, and `15minute` analysis
- Phase 5 derivatives/OI layer is implemented with Zerodha-backed option-chain normalization
- Signal generation now degrades safely to `NO_TRADE` when candle history is insufficient
- Market-mode and candle-requirement services are implemented
- File-based repositories exist for candles, market context, and watchlists
- Nifty 50 scanner is implemented
- Scheduler is implemented for recurring scans during market hours
- Rate limiter is implemented and integrated into quote and historical clients
- Signal logger is implemented for daily JSON logs
- Jest test suite is passing

## Features

- Production-style module separation for auth, data access, indicators, signals, scanning, scheduling, and logging
- Nifty 50 universe scan with per-symbol fault tolerance
- Filtering that logs only actionable intraday signals
- Safe handling for Zerodha historical candle count inconsistencies
- Explicit candle policy for `1minute`, `5minute`, `15minute`, and `day`
- Multi-timeframe analysis using `minute`, `5minute`, and `15minute`
- VWAP, ATR, MACD, support/resistance, and breakout evidence in signal payloads
- Option-chain normalization for NFO contracts when derivatives data is available
- Deterministic OI evidence: PCR, max pain, call/put walls, OI support, and OI resistance
- Confidence adjustment when derivatives confirm or conflict with the technical signal
- Queue-based API throttling to avoid burst requests
- Market-hours-only scheduler using `setInterval`
- JSON log files written per trading day
- Development auth scripts for login URL generation and auto token capture
- CLI entry points for one-time scans and scheduled scanning
- Test coverage for auth, indicators, signal engine, signal service, scanner behavior, rate limiting, and guarded live Zerodha integrations

## Architecture

The codebase now follows a hexagonal shape:

```text
controllers -> services/use-cases -> engines
                         |
                         -> adapters/repositories
```

Rules:

- Controllers handle CLI/API entry flows.
- Services orchestrate use cases and dependency wiring.
- Engines contain deterministic trading logic and do not call APIs.
- Adapters talk to Zerodha or other external systems.
- Repositories own local file persistence.

Core flow:

1. Zerodha session is created and access token is persisted
2. Optional development flow updates `.env` automatically after callback exchange
3. `runner.js` delegates to `ScannerController`
4. `RuntimeService` loads the access token and builds runtime dependencies
5. Zerodha quote/history access goes through adapters
6. `ScannerService` scans the configured Nifty 50 universe
7. `ScannerService` creates a `scan_id` and one `symbol_analysis_id` per stock
8. `SignalAnalysisService` fetches LTP and multi-timeframe historical candles for each symbol
9. If available, derivatives data is normalized and analyzed for OI confirmation
10. If historical candles are insufficient, a safe `NO_TRADE` response is returned
11. Otherwise indicators are computed and mapped through technical engines into an intraday signal contract
12. Actionable signals are printed and logged with entry, stop loss, targets, confidence, and invalidation
13. Scheduler repeats the process during market hours

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
│   ├── adapters
│   │   └── zerodha
│   │       ├── KiteAuthAdapter.js
│   │       ├── KiteDerivativesAdapter.js
│   │       ├── KiteHistoricalAdapter.js
│   │       └── KiteQuoteAdapter.js
│   ├── auth
│   │   ├── login.js
│   │   └── token.js
│   ├── config
│   │   └── nifty50.js
│   ├── controllers
│   │   ├── AuthController.js
│   │   └── ScannerController.js
│   ├── data
│   │   ├── kiteClient.js
│   │   ├── kiteDerivatives.js
│   │   └── kiteHistorical.js
│   ├── engines
│   │   ├── derivatives
│   │   │   ├── DerivativesConfirmationEngine.js
│   │   │   ├── DerivativesOiEngine.js
│   │   │   └── OptionChainNormalizer.js
│   │   └── technical
│   │       ├── ConfidenceScorer.js
│   │       ├── IntradaySignalEngine.js
│   │       ├── MultiTimeframeAnalyzer.js
│   │       ├── RiskManager.js
│   │       ├── SignalContractBuilder.js
│   │       ├── SignalTypes.js
│   │       ├── indicators
│   │       │   ├── AtrIndicator.js
│   │       │   ├── MacdIndicator.js
│   │       │   └── VwapIndicator.js
│   │       └── price_action
│   │           ├── BreakoutDetector.js
│   │           └── SupportResistanceDetector.js
│   ├── indicators
│   │   ├── ema.js
│   │   ├── rsi.js
│   │   ├── trend.js
│   │   └── volume.js
│   ├── logger
│   │   ├── RunContext.js
│   │   ├── logger.js
│   │   ├── obsidianLogger.js
│   │   └── signalLogger.js
│   ├── market
│   │   ├── CandleRequirementService.js
│   │   └── MarketClock.js
│   ├── repositories
│   │   ├── CandleRepository.js
│   │   ├── JsonFileRepository.js
│   │   ├── MarketContextRepository.js
│   │   └── WatchlistRepository.js
│   ├── scanner
│   │   └── scannerService.js
│   ├── scheduler
│   │   └── scheduler.js
│   ├── services
│   │   ├── RuntimeService.js
│   │   ├── ScannerService.js
│   │   ├── SignalAnalysisService.js
│   │   └── signalService.js
│   ├── signals
│   │   ├── SignalContractBuilder.js
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
    ├── derivativesOiEngine.test.js
    ├── envFile.test.js
    ├── indicators.test.js
    ├── kiteDerivatives.test.js
    ├── liveMarketData.test.js
    ├── phase4TechnicalEngine.test.js
    ├── rateLimiter.test.js
    ├── scanner.test.js
    ├── obsidianLogger.test.js
    ├── runContext.test.js
    ├── signalContract.test.js
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
- fetches LTP and `minute`, `5minute`, and `15minute` candles through rate-limited clients
- computes real indicators and price-action evidence
- fetches and analyzes Zerodha NFO derivatives snapshots when configured
- identifies market mode before signal generation
- prefers target-count candle fetching for multi-timeframe candles when the historical client supports it
- returns `NO_TRADE` with reason `INSUFFICIENT_DATA` when fewer than 50 candles are available
- returns `NO_TRADE` with reason `MARKET_MODE_BLOCKED` when runtime signal generation is enforced outside live market modes
- logs only actionable intraday signals
- skips `NO_TRADE`
- scans only during `09:15` to `15:30` IST on weekdays
- continues scanning even if one symbol fails

## Intraday Signal Contract

The current Phase 5 contract combines deterministic indicators, price-action evidence, multi-timeframe alignment, and derivatives/OI confirmation into actionable intraday fields. It still does not include portfolio awareness, backtesting, Discord delivery, or AI critique.

Actionable signal types:

- `INTRADAY_LONG`
- `INTRADAY_SHORT`

Non-actionable signal types:

- `WAIT_FOR_BREAKOUT`
- `WAIT_FOR_PULLBACK`
- `NO_TRADE`
- `AVOID`

Actionable payloads include:

- `run_id`, `scan_id`, `symbol_analysis_id`, `signal_id`
- `trade_action`
- `entry_zone`
- `stop_loss`
- `targets`
- `risk_reward`
- `confidence_score`
- `valid_until`
- `setup_name`
- `reason`
- `invalidation_reason`
- `evidence`

Phase 4 evidence includes:

- `vwap`
- `atr`
- `macd_bias`
- `support`
- `resistance`
- `breakout`
- `multi_timeframe_bias`

Phase 5 derivatives evidence includes:

- `derivatives_status`
- `derivatives_bias`
- `oi_confirmation`
- `pcr`
- `max_pain`
- `oi_support`
- `oi_resistance`

## Candle Policy

The scanner now uses explicit candle requirements instead of thinking only in fixed lookback minutes.

```text
1minute  => target 120, minimum 50
5minute  => target 120, minimum 50
15minute => target 80,  minimum 30
day      => target 60,  minimum 20
```

Market modes:

```text
PRE_MARKET
OPENING_MARKET
ACTIVE_MARKET
LATE_MARKET
POST_MARKET
WEEKEND_OR_HOLIDAY
```

Runtime behavior:

- `PRE_MARKET`, `POST_MARKET`, and `WEEKEND_OR_HOLIDAY` block live intraday signal generation when enforcement is enabled.
- `OPENING_MARKET`, `ACTIVE_MARKET`, and `LATE_MARKET` allow scanner signals.
- Historical fetching uses target candle count and a wider max lookback so opening-market scans can use previous-session candles as warmup.
- If target candles are unavailable but minimum candles are available, the signal is marked degraded and confidence is capped.
- If minimum candles are unavailable, the scanner returns safe `NO_TRADE`.

## Data Persistence Boundary

Reusable market data and prepared context belong under `data/`, separate from execution logs:

```text
data/
  market_context/
    YYYY-MM-DD.json
  candles/
    NSE_INFY/
      minute/
        YYYY-MM-DD.json
      5minute/
        YYYY-MM-DD.json
      15minute/
        YYYY-MM-DD.json
      day/
        history.json
  watchlists/
    YYYY-MM-DD.json
```

Current repositories:

- `CandleRepository`
- `MarketContextRepository`
- `WatchlistRepository`

`data/` is ignored by git because it can contain market snapshots and local trading context.

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
    "signal_type": "INTRADAY_LONG",
    "trade_action": "BUY",
    "entry_zone": { "min": 1576.84, "max": 1583.16 },
    "stop_loss": 1567.36,
    "targets": [1595.8, 1605.28],
    "confidence_score": 75,
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

- Maintains per-day JSON array of persisted actionable intraday signal payloads.

3) Obsidian markdown notes (`logs/obsidian/YYYY-MM-DD.md`):

```md
## 09:30 - NSE:INFY - INTRADAY_LONG

- Signal ID: signal_...
- Run ID: run_...
- Scan ID: scan_...
- Symbol Analysis ID: symbol_...

### Trade Plan

- Action: BUY
- Price: 1580
- Entry: 1576.84 - 1583.16
- Stop Loss: 1567.36
- Targets: 1595.8 / 1605.28
- Confidence: 75%

### Post-Market Review

- Outcome: Pending
- Mistake/Learning: Pending
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
- signal decisions: full decision payload with `run_id`, `scan_id`, `symbol_analysis_id`, `signal_id`, trade plan, evidence, and reason
- candle fetches: interval, target candles, required candles, received candles, max lookback, and market mode
- indicator evidence: RSI, EMA trend, VWAP, ATR, MACD, support/resistance, breakout, and multi-timeframe bias
- derivatives evidence: status, bias, PCR, max pain, OI support/resistance, and confirmation/conflict
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
- market mode classification
- candle requirement policy
- file-based repositories
- indicator calculations
- Phase 4 VWAP, ATR, MACD, support/resistance, breakout, multi-timeframe analysis, and ATR-based risk
- Phase 5 derivatives normalization, OI metrics, confirmation/conflict, and safe fallback
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
- Current intraday strategy logic is deterministic and improving, but still needs Phase 8 backtesting before trust
- The application currently uses REST polling only
- WebSockets are not implemented yet
- OI-specific strategy logic is implemented as a deterministic confirmation layer, not a standalone signal source
- Market holidays are not explicitly checked yet; only weekday and market-hour windows are enforced

## Roadmap

- Phase 4: intraday technical signal engine with multi-timeframe analysis, VWAP, ATR, MACD, RSI, EMA, volume, price action, entry, stop, targets, and confidence. First implementation slice completed.
- Phase 5: derivatives/OI layer with option chain, OI buildup, PCR, max pain, and OI support/resistance. First implementation slice completed.
- Phase 6: Discord notifications using deterministic templates, not AI.
- Phase 7: portfolio and position awareness using JSON first, then optional Zerodha holdings/positions.
- Phase 8: backtesting and 10-15 non-overfitted scenario tests.
- Phase 9: post-market review and learning journal.
- Phase 10: macro, news, company-event, fundamentals, and AI critique layer.
