/**
 * Formatting helpers for money amounts (USD).
 *
 * NanoGPT prices are small per-generation dollar amounts, so we show more
 * precision below one cent (e.g. "$0.0032") and normal 2-decimal formatting
 * above it. Central to the "cost transparency before every click" principle —
 * every cost shown in the UI goes through these helpers.
 */

/** Format a dollar amount for display, e.g. 1.5 -> "$1.50", 0.0032 -> "$0.0032". */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '$—'
  if (amount < 0) return `-${formatUsd(-amount)}`
  if (amount === 0) return '$0.00'
  if (amount < 0.01) {
    // Sub-cent amounts keep at least two significant digits (capped at 8
    // decimals) so a tiny-but-real price never collapses to "$0" — TTS
    // narrations can cost fractions of a tenth of a cent, and "exact cost"
    // must never read as free.
    const digits = Math.min(8, Math.max(4, -Math.floor(Math.log10(amount)) + 1))
    return `$${amount.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}`
  }
  return `$${amount.toFixed(2)}`
}

/** Format an estimated cost range, e.g. "$0.02–$0.05" (equal ends collapse). */
export function formatUsdRange(min: number, max: number): string {
  if (min === max) return formatUsd(min)
  return `${formatUsd(min)}–${formatUsd(max)}`
}
