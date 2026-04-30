const MAX_DISCORD_CONTENT_LENGTH = 1900;

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  return String(value);
}

function formatEntryZone(entry_zone) {
  if (!entry_zone || typeof entry_zone !== "object") {
    return "n/a";
  }

  return `${formatValue(entry_zone.min)} - ${formatValue(entry_zone.max)}`;
}

function formatTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return "n/a";
  }

  return targets.map(formatValue).join(" / ");
}

function truncateContent(content) {
  if (content.length <= MAX_DISCORD_CONTENT_LENGTH) {
    return content;
  }

  return `${content.slice(0, MAX_DISCORD_CONTENT_LENGTH - 15)}... [truncated]`;
}

class DiscordSignalFormatter {
  format(signalPayload) {
    const evidence = signalPayload?.evidence || {};
    const indicators = signalPayload?.indicators || {};
    const derivatives = indicators.derivatives || {};
    const lines = [
      ...this.#formatTradePlan(signalPayload),
      "",
      `Reason: ${formatValue(signalPayload.reason)}`,
      `Invalidation: ${formatValue(signalPayload.invalidation_reason)}`,
      "",
      this.#formatPositionContext(signalPayload.position_context),
      "",
      this.#formatTechnicalEvidence(evidence),
      this.#formatDerivativesEvidence({ derivatives, evidence }),
      this.#formatOiEvidence({ derivatives, evidence }),
      "",
      ...this.#formatIds(signalPayload),
    ];

    return truncateContent(lines.join("\n"));
  }

  #formatTradePlan(signalPayload) {
    return [
      `**${formatValue(signalPayload.signal_type || signalPayload.signal)} ${formatValue(signalPayload.symbol)}**`,
      `Action: ${formatValue(signalPayload.trade_action)} | LTP: ${formatValue(signalPayload.ltp)}`,
      `Entry: ${formatEntryZone(signalPayload.entry_zone)}`,
      `Stop Loss: ${formatValue(signalPayload.stop_loss)}`,
      `Targets: ${formatTargets(signalPayload.targets)}`,
      `Risk/Reward: ${formatValue(signalPayload.risk_reward)} | Confidence: ${formatValue(signalPayload.confidence_score)}%`,
      `Valid Until: ${formatValue(signalPayload.valid_until)}`,
    ];
  }

  #formatTechnicalEvidence(evidence) {
    return `Technical: RSI ${formatValue(evidence.rsi)}, trend ${formatValue(evidence.ema_alignment)}, `
      + `breakout ${formatValue(evidence.breakout)}, MTF ${formatValue(evidence.multi_timeframe_bias)}`;
  }

  #formatPositionContext(position_context) {
    if (!position_context || position_context.has_position !== true) {
      return `Position: no existing holding | ${formatValue(position_context?.interpretation)}`;
    }

    return `Position: holding ${formatValue(position_context.quantity)} @ ${formatValue(position_context.average_price)}, `
      + `allocation ${formatValue(position_context.allocation_percent)}%, `
      + `P&L ${formatValue(position_context.unrealized_pnl)} | `
      + `fallback ${formatValue(position_context.delivery_fallback?.is_allowed ? "conditional" : "not allowed")}`;
  }

  #formatDerivativesEvidence({ derivatives, evidence }) {
    return `Derivatives: status ${formatValue(derivatives.status || evidence.derivatives_status)}, `
      + `bias ${formatValue(derivatives.derivativesBias || evidence.derivatives_bias)}, `
      + `confirmation ${formatValue(derivatives.oiConfirmation || evidence.oi_confirmation)}`;
  }

  #formatOiEvidence({ derivatives, evidence }) {
    return `OI: PCR ${formatValue(derivatives.pcr || evidence.pcr)}, `
      + `max pain ${formatValue(derivatives.maxPain || evidence.max_pain)}, `
      + `support ${formatValue(derivatives.oiSupport || evidence.oi_support)}, `
      + `resistance ${formatValue(derivatives.oiResistance || evidence.oi_resistance)}`;
  }

  #formatIds(signalPayload) {
    return [
      `IDs: run ${formatValue(signalPayload.run_id)} | scan ${formatValue(signalPayload.scan_id)}`,
      `Symbol Analysis: ${formatValue(signalPayload.symbol_analysis_id)}`,
      `Signal: ${formatValue(signalPayload.signal_id)}`,
    ];
  }
}

function formatDiscordSignal(signalPayload) {
  return new DiscordSignalFormatter().format(signalPayload);
}

module.exports = {
  DiscordSignalFormatter,
  formatDiscordSignal,
};
