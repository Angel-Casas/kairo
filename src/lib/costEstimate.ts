/**
 * Cost estimation for generations. Pure functions, no UI strings.
 *
 * Estimates are honest approximations shown BEFORE any money is spent
 * (CLAUDE.md: cost transparency before every click). Token counts are
 * heuristic (~4 characters per token, the usual English average), so callers
 * should present results with a "~" prefix.
 */

export const CHARS_PER_TOKEN = 4

/**
 * Output budget we request for a short-form script generation. A ≤60s script
 * is 120-150 words (~160-200 tokens); 300 leaves headroom without inflating
 * the estimate. This value is ALSO sent as max_tokens, so the estimate is a
 * true ceiling, not a guess (verified against real spend, 2026-08-16).
 */
export const SCRIPT_OUTPUT_TOKEN_BUDGET = 300

/**
 * Output budget for a scene breakdown: 5-10 scenes × (~25-token excerpt +
 * ~35-token visual description + JSON overhead) ≈ 600 tokens worst case;
 * 800 leaves headroom. Enforced via max_tokens like all budgets.
 */
export const SCENES_OUTPUT_TOKEN_BUDGET = 800

/**
 * Output budget for style-from-image notes: one line of comma-separated
 * style fragments (~60-100 tokens); 150 leaves headroom. Enforced via
 * max_tokens like all budgets. NOTE: the IMAGE input adds prompt tokens
 * whose count depends on the model — the text-side estimate cannot include
 * them, so callers must say so; actuals from usage cover the full cost.
 */
export const STYLE_FROM_IMAGE_OUTPUT_TOKEN_BUDGET = 150

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

export interface ActualChatCostParams {
  promptTokens: number
  completionTokens: number
  promptPricePerMTok: number | null
  completionPricePerMTok: number | null
}

/**
 * Actual USD cost computed from the API's reported token usage. Null when the
 * model exposes no pricing. (Provider-side discounts may make the billed
 * amount slightly lower — this is the list-price cost.)
 */
export function computeActualChatCostUsd(
  params: ActualChatCostParams,
): number | null {
  if (
    params.promptPricePerMTok === null &&
    params.completionPricePerMTok === null
  ) {
    return null
  }
  return (
    (params.promptTokens / 1_000_000) * (params.promptPricePerMTok ?? 0) +
    (params.completionTokens / 1_000_000) * (params.completionPricePerMTok ?? 0)
  )
}
