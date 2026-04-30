const BACKTEST_OUTCOMES = {
  TARGET_HIT: "target_hit",
  STOP_LOSS_HIT: "stop_loss_hit",
  NO_ENTRY: "no_entry",
  OPEN_AT_END: "open_at_end",
  AMBIGUOUS_STOP_AND_TARGET: "ambiguous_stop_and_target",
  INVALID_SIGNAL: "invalid_signal",
  DATA_UNAVAILABLE: "data_unavailable",
};

function toNumber(value) {
  const numeric_value = Number(value);
  return Number.isFinite(numeric_value) ? numeric_value : null;
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundNumber(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(4));
}

class BacktestOutcomeEngine {
  evaluate({ signal, candles }) {
    const normalized_signal = this.#normalizeSignal(signal);
    if (!normalized_signal) return this.#buildInvalidResult(signal);

    const replay_candles = this.#getReplayCandles({ signal: normalized_signal, candles });
    const entry = this.#findEntry({ signal: normalized_signal, candles: replay_candles });
    if (!entry) return this.#buildNoEntryResult(normalized_signal, replay_candles);

    return this.#evaluateExit({ signal: normalized_signal, candles: replay_candles, entry });
  }

  #normalizeSignal(signal) {
    const signal_type = signal?.signal_type || signal?.signal;
    const targets = Array.isArray(signal?.targets) ? signal.targets.map(toNumber).filter(Boolean) : [];

    const entry_zone = {
      min: toNumber(signal?.entry_zone?.min),
      max: toNumber(signal?.entry_zone?.max),
    };
    const stop_loss = toNumber(signal?.stop_loss);
    const direction = this.#getDirection(signal_type, signal?.trade_action);

    if (
      !signal?.symbol
      || !signal_type
      || !direction
      || targets.length === 0
      || !Number.isFinite(entry_zone.min)
      || !Number.isFinite(entry_zone.max)
      || !Number.isFinite(stop_loss)
    ) {
      return null;
    }

    return {
      ...signal,
      signal_type,
      entry_zone,
      ltp: toNumber(signal.ltp),
      stop_loss,
      targets,
      timestamp: toDate(signal.timestamp),
      valid_until: toDate(signal.valid_until),
      direction,
    };
  }

  #getDirection(signal_type, trade_action) {
    if (signal_type === "INTRADAY_LONG" || trade_action === "BUY") return "long";
    if (signal_type === "INTRADAY_SHORT" || trade_action === "SELL") return "short";
    return null;
  }

  #getReplayCandles({ signal, candles }) {
    if (!Array.isArray(candles)) return [];

    return candles
      .filter((candle) => this.#isValidCandle(candle))
      .filter((candle) => !signal.timestamp || toDate(candle.timestamp) >= signal.timestamp)
      .sort((first, second) => toDate(first.timestamp) - toDate(second.timestamp));
  }

  #isValidCandle(candle) {
    return toDate(candle?.timestamp)
      && Number.isFinite(candle.open)
      && Number.isFinite(candle.high)
      && Number.isFinite(candle.low)
      && Number.isFinite(candle.close);
  }

  #findEntry({ signal, candles }) {
    if (this.#isPriceInsideEntryZone(signal.ltp, signal.entry_zone)) {
      return {
        price: signal.ltp,
        timestamp: signal.timestamp?.toISOString() || candles[0]?.timestamp || null,
        source: "signal_ltp",
      };
    }

    const entry_candle = candles.find((candle) => {
      if (signal.valid_until && toDate(candle.timestamp) > signal.valid_until) return false;
      return this.#doesCandleTouchEntryZone({ candle, signal });
    });

    if (!entry_candle) return null;

    return {
      price: signal.direction === "long" ? signal.entry_zone.max : signal.entry_zone.min,
      timestamp: entry_candle.timestamp,
      source: "entry_zone_touch",
    };
  }

  #isPriceInsideEntryZone(price, entry_zone) {
    return Number.isFinite(price) && price >= entry_zone.min && price <= entry_zone.max;
  }

  #doesCandleTouchEntryZone({ candle, signal }) {
    return candle.high >= signal.entry_zone.min && candle.low <= signal.entry_zone.max;
  }

  #evaluateExit({ signal, candles, entry }) {
    const entry_time = toDate(entry.timestamp);
    const exit_candles = candles.filter((candle) => !entry_time || toDate(candle.timestamp) >= entry_time);

    for (const candle of exit_candles) {
      const stop_hit = this.#isStopHit({ signal, candle });
      const target_index = this.#getTargetHitIndex({ signal, candle });

      if (stop_hit && target_index !== -1) {
        return this.#buildExitResult({
          signal,
          entry,
          candle,
          outcome: BACKTEST_OUTCOMES.AMBIGUOUS_STOP_AND_TARGET,
          exit_price: signal.stop_loss,
          target_index,
        });
      }
      if (stop_hit) return this.#buildStopResult({ signal, entry, candle });
      if (target_index !== -1) return this.#buildTargetResult({ signal, entry, candle, target_index });
    }

    return this.#buildOpenResult({ signal, entry, candles: exit_candles });
  }

  #isStopHit({ signal, candle }) {
    if (signal.direction === "long") return candle.low <= signal.stop_loss;
    if (signal.direction === "short") return candle.high >= signal.stop_loss;
    return false;
  }

  #getTargetHitIndex({ signal, candle }) {
    const target_hits = signal.targets.map((target, index) => {
      if (signal.direction === "long") return candle.high >= target ? index : -1;
      if (signal.direction === "short") return candle.low <= target ? index : -1;
      return -1;
    });

    return Math.max(...target_hits);
  }

  #buildTargetResult({ signal, entry, candle, target_index }) {
    return this.#buildExitResult({
      signal,
      entry,
      candle,
      outcome: BACKTEST_OUTCOMES.TARGET_HIT,
      exit_price: signal.targets[target_index],
      target_index,
    });
  }

  #buildStopResult({ signal, entry, candle }) {
    return this.#buildExitResult({
      signal,
      entry,
      candle,
      outcome: BACKTEST_OUTCOMES.STOP_LOSS_HIT,
      exit_price: signal.stop_loss,
      target_index: -1,
    });
  }

  #buildExitResult({ signal, entry, candle, outcome, exit_price, target_index }) {
    return {
      signal_id: signal.signal_id || null,
      symbol: signal.symbol,
      signal_type: signal.signal_type,
      outcome,
      entry,
      exit: {
        price: exit_price,
        timestamp: candle.timestamp,
        candle,
      },
      target_index,
      r_multiple: this.#calculateRMultiple({ signal, entry_price: entry.price, exit_price }),
    };
  }

  #buildOpenResult({ signal, entry, candles }) {
    const last_candle = candles[candles.length - 1] || null;
    const exit_price = last_candle?.close ?? entry.price;

    return {
      signal_id: signal.signal_id || null,
      symbol: signal.symbol,
      signal_type: signal.signal_type,
      outcome: BACKTEST_OUTCOMES.OPEN_AT_END,
      entry,
      exit: {
        price: exit_price,
        timestamp: last_candle?.timestamp || null,
        candle: last_candle,
      },
      target_index: -1,
      r_multiple: this.#calculateRMultiple({ signal, entry_price: entry.price, exit_price }),
    };
  }

  #buildNoEntryResult(signal, candles) {
    return {
      signal_id: signal.signal_id || null,
      symbol: signal.symbol,
      signal_type: signal.signal_type,
      outcome: BACKTEST_OUTCOMES.NO_ENTRY,
      entry: null,
      exit: null,
      candles_evaluated: candles.length,
      r_multiple: 0,
    };
  }

  #buildInvalidResult(signal) {
    return {
      signal_id: signal?.signal_id || null,
      symbol: signal?.symbol || null,
      signal_type: signal?.signal_type || signal?.signal || null,
      outcome: BACKTEST_OUTCOMES.INVALID_SIGNAL,
      entry: null,
      exit: null,
      r_multiple: 0,
    };
  }

  #calculateRMultiple({ signal, entry_price, exit_price }) {
    const risk = Math.abs(entry_price - signal.stop_loss);
    if (!risk) return 0;

    const pnl = signal.direction === "short" ? entry_price - exit_price : exit_price - entry_price;
    return roundNumber(pnl / risk);
  }
}

module.exports = {
  BACKTEST_OUTCOMES,
  BacktestOutcomeEngine,
};
