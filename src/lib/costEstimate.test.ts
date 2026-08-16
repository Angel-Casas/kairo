import { describe, expect, it } from 'vitest'
import {
  computeActualChatCostUsd,
  estimateChatCostUsd,
  estimateTokensFromText,
  SCRIPT_OUTPUT_TOKEN_BUDGET,
} from './costEstimate'

describe('estimateTokensFromText', () => {
  it('is zero for empty text', () => {
    expect(estimateTokensFromText('')).toBe(0)
  })

  it('rounds up at ~4 chars per token', () => {
    expect(estimateTokensFromText('abcd')).toBe(1)
    expect(estimateTokensFromText('abcde')).toBe(2)
    expect(estimateTokensFromText('a'.repeat(400))).toBe(100)
  })
})

describe('estimateChatCostUsd', () => {
  it('combines input and output cost', () => {
    const cost = estimateChatCostUsd({
      promptText: 'a'.repeat(4_000_000), // 1M tokens
      outputTokenBudget: 1_000_000,
      promptPricePerMTok: 2,
      completionPricePerMTok: 10,
    })
    expect(cost).toBeCloseTo(12, 6)
  })

  it('scales with the script output budget', () => {
    const cost = estimateChatCostUsd({
      promptText: '',
      outputTokenBudget: SCRIPT_OUTPUT_TOKEN_BUDGET,
      promptPricePerMTok: 0,
      completionPricePerMTok: 5,
    })
    // 300 tokens at $5/MTok = $0.0015
    expect(cost).toBeCloseTo(0.0015, 9)
  })

  it('treats a missing side of pricing as zero when the other exists', () => {
    const cost = estimateChatCostUsd({
      promptText: 'a'.repeat(400),
      outputTokenBudget: 100,
      promptPricePerMTok: null,
      completionPricePerMTok: 10,
    })
    // 100 output tokens at $10/MTok = $0.001; input side priced at 0.
    expect(cost).toBeCloseTo(0.001, 9)
    expect(cost).not.toBeNull()
  })

  it('returns null (unknown), never zero, when the model has no pricing at all', () => {
    expect(
      estimateChatCostUsd({
        promptText: 'hello',
        outputTokenBudget: 1000,
        promptPricePerMTok: null,
        completionPricePerMTok: null,
      }),
    ).toBeNull()
  })
})

describe('computeActualChatCostUsd', () => {
  it('matches a real NanoGPT request (Qwen3.8 27B, 117→192 tokens)', () => {
    // Real request from 2026-08-16 billed $0.000592 (after a small discount);
    // list price: 117/1M*$0.40 + 192/1M*$3.00 = $0.0006228.
    const cost = computeActualChatCostUsd({
      promptTokens: 117,
      completionTokens: 192,
      promptPricePerMTok: 0.4,
      completionPricePerMTok: 3,
    })
    expect(cost).toBeCloseTo(0.0006228, 7)
  })

  it('returns null when the model has no pricing', () => {
    expect(
      computeActualChatCostUsd({
        promptTokens: 100,
        completionTokens: 100,
        promptPricePerMTok: null,
        completionPricePerMTok: null,
      }),
    ).toBeNull()
  })
})
