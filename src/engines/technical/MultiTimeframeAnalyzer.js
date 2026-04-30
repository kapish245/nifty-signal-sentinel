const { calculateRSI } = require("../../indicators/rsi");
const { calculateEmaPair } = require("../../indicators/ema");
const { detectTrend } = require("../../indicators/trend");
const { detectVolumeTrend } = require("../../indicators/volume");
const { calculateATR } = require("./indicators/AtrIndicator");
const { calculateMACD } = require("./indicators/MacdIndicator");
const { calculateVWAP } = require("./indicators/VwapIndicator");
const { detectBreakout } = require("./price_action/BreakoutDetector");
const { detectSupportResistance } = require("./price_action/SupportResistanceDetector");

class MultiTimeframeAnalyzer {
  analyze({ frames, ltp }) {
    const primary_frame = this.#getRequiredFrame(frames, "5minute");
    const primary_analysis = this.#analyzeFrame({ candles: primary_frame, ltp });
    const timeframe_analysis = this.#buildTimeframeAnalysis({ frames, ltp });

    return {
      ...primary_analysis,
      timeframes: timeframe_analysis,
      multiTimeframeBias: this.#getMultiTimeframeBias(timeframe_analysis),
    };
  }

  #buildTimeframeAnalysis({ frames, ltp }) {
    return Object.fromEntries(
      Object.entries(frames).map(([interval, candles]) => [
        interval,
        this.#analyzeFrame({ candles, ltp }),
      ]),
    );
  }

  #analyzeFrame({ candles, ltp }) {
    const close_prices = candles.map((candle) => candle.close);
    const { ema20, ema50 } = calculateEmaPair(close_prices);
    const { priceTrend, emaAlignment } = detectTrend({ price: ltp, ema20, ema50 });
    const volume = detectVolumeTrend(candles);
    const levels = detectSupportResistance(candles);
    const breakout = detectBreakout({
      price: ltp,
      support: levels.support,
      resistance: levels.resistance,
      volumeTrend: volume,
    });

    return {
      priceTrend,
      emaAlignment,
      rsi: calculateRSI(close_prices, 14),
      volume,
      vwap: calculateVWAP(candles),
      atr: calculateATR(candles, 14),
      macd: calculateMACD(close_prices),
      support: levels.support,
      resistance: levels.resistance,
      breakout,
    };
  }

  #getRequiredFrame(frames, interval) {
    const candles = frames?.[interval];

    if (!Array.isArray(candles) || candles.length === 0) {
      throw new Error(`${interval} candles are required for multi-timeframe analysis`);
    }

    return candles;
  }

  #getMultiTimeframeBias(timeframe_analysis) {
    const frame_values = Object.values(timeframe_analysis);
    const bullish_count = frame_values.filter((frame) => frame.emaAlignment === "bullish").length;
    const bearish_count = frame_values.filter((frame) => frame.emaAlignment === "bearish").length;

    if (bullish_count >= 2) return "bullish";
    if (bearish_count >= 2) return "bearish";
    return "neutral";
  }
}

module.exports = MultiTimeframeAnalyzer;
