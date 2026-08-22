import { describe, expect, it } from 'vitest'
import { formatUsd, formatUsdRange } from './format'

describe('formatUsd', () => {
  it('formats regular amounts with two decimals', () => {
    expect(formatUsd(1.5)).toBe('$1.50')
    expect(formatUsd(12)).toBe('$12.00')
    expect(formatUsd(0.25)).toBe('$0.25')
  })

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00')
  })

  it('keeps precision for sub-cent amounts', () => {
    expect(formatUsd(0.0032)).toBe('$0.0032')
    expect(formatUsd(0.001)).toBe('$0.001')
    expect(formatUsd(0.0005)).toBe('$0.0005')
  })

  it('never collapses a tiny-but-real price to "$0"', () => {
    // 33 characters of Kokoro narration cost $0.000033 — the exact price
    // must render, not round away to zero.
    expect(formatUsd(0.000033)).toBe('$0.000033')
    expect(formatUsd(0.00001)).toBe('$0.00001')
    expect(formatUsd(0.0000001)).toBe('$0.0000001')
  })

  it('handles negative amounts', () => {
    expect(formatUsd(-1.5)).toBe('-$1.50')
  })

  it('never renders NaN or Infinity', () => {
    expect(formatUsd(Number.NaN)).toBe('$—')
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('$—')
  })
})

describe('formatUsdRange', () => {
  it('renders a range', () => {
    expect(formatUsdRange(0.02, 0.05)).toBe('$0.02–$0.05')
  })

  it('collapses equal ends', () => {
    expect(formatUsdRange(0.02, 0.02)).toBe('$0.02')
  })
})
