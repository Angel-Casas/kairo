import { describe, expect, it } from 'vitest'
import { creditsByKind } from './ExportStage'
import type { CostLogEntry, GenerationKind } from '../domain/types'

function entry(kind: GenerationKind, model: string): CostLogEntry {
  return {
    id: `${kind}-${model}-${Math.random().toString(36).slice(2)}`,
    at: '2026-08-01T12:00:00.000Z',
    kind,
    model,
    estimatedUsd: 0.01,
    actualUsd: 0.01,
    note: 'test',
  }
}

describe('creditsByKind', () => {
  it('groups distinct models under their department', () => {
    const credits = creditsByKind([
      entry('text', 'gpt-5'),
      entry('audio', 'kokoro'),
      entry('image', 'flux-dev'),
      entry('video', 'kling'),
    ])
    expect(credits).toEqual({
      text: ['gpt-5'],
      audio: ['kokoro'],
      image: ['flux-dev'],
      video: ['kling'],
    })
  })

  it('lists each model once, in first-appearance order', () => {
    const credits = creditsByKind([
      entry('image', 'flux-dev'),
      entry('image', 'sdxl'),
      entry('image', 'flux-dev'),
      entry('image', 'flux-dev'),
    ])
    expect(credits.image).toEqual(['flux-dev', 'sdxl'])
  })

  it('returns an empty record for an empty cost log', () => {
    expect(creditsByKind([])).toEqual({})
  })
})
