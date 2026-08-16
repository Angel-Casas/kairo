/**
 * Cost estimation for generations. Pure functions, no UI strings.
 *
 * Estimates are honest approximations shown BEFORE any money is spent
 * (CLAUDE.md: cost transparency before every click). Token counts are
 * heuristic (~4 characters per token, the usual English average), so callers
 * should present results with a "~" prefix.
 */

export const CHARS_PER_TOKEN = 4

/** Output budget we request for a short-form script generation. */
export const SCRIPT_OUTPUT_TOKEN_BUDGET = 1000

export function estimateTokensFromText(text: string): number {
  if (text.length === 0) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export interface ChatCostParams {
  /** Full prompt text that will be sent (system + user messages). */
  promptText: string
  /** Maximum output tokens we will request. */
  outputTokenBudget: number
  /** USD per million input tokens; null when the model has no listed price. */
  promptPricePerMTok: number | null
  /** USD per million output tokens; null when the model has no listed price. */
  completionPricePerMTok: number | null
}

/**
 * Estimated USD cost of a chat completion, or null when the model exposes no
 * pricing (callers must then say "cost unknown" rather than "$0.00" —
 * pretending unknown is free would violate cost transparency).
 */
export function estimateChatCostUsd(params: ChatCostParams): number | null {
  if (
    params.promptPricePerMTok === null &&
    params.completionPricePerMTok === null
  ) {
    return null
  }
  const inputTokens = estimateTokensFromText(params.promptText)
  const inputCost = (inputTokens / 1_000_000) * (params.promptPricePerMTok ?? 0)
  const outputCost =
    (params.outputTokenBudget / 1_000_000) *
    (params.completionPricePerMTok ?? 0)
  return inputCost + outputCost
}
