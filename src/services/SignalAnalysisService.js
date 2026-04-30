const {
  CANDLE_SUFFICIENCY_MODES,
  createSignalService,
  createSignalServiceFromConfig,
  createRealIndicatorProvider,
  deriveMockOiSignal,
  getDefaultLookbackMinutes,
  getDefaultTargetCandleCount,
  MIN_REQUIRED_CANDLES,
} = require("./signalService");

class SignalAnalysisService {
  #delegate;

  constructor(config = {}) {
    this.#delegate = createSignalService(config);
  }

  getSignal(symbol, ids) {
    return this.#delegate.getSignal(symbol, ids);
  }
}

function createSignalAnalysisService(config) {
  return new SignalAnalysisService(config);
}

module.exports = {
  CANDLE_SUFFICIENCY_MODES,
  SignalAnalysisService,
  createSignalAnalysisService,
  createSignalService,
  createSignalServiceFromConfig,
  createRealIndicatorProvider,
  deriveMockOiSignal,
  getDefaultLookbackMinutes,
  getDefaultTargetCandleCount,
  MIN_REQUIRED_CANDLES,
};
