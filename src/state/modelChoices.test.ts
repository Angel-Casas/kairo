import { beforeEach, describe, expect, it } from 'vitest'
import { loadStoredChoices, useModelChoicesStore } from './modelChoices'

const STORAGE_KEY = 'kairo.modelChoices'

describe('model choices (22.12 — picks survive stage hops)', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    useModelChoicesStore.setState({ choices: {} })
  })

  it('remembers a choice and mirrors it to localStorage', () => {
    useModelChoicesStore.getState().remember('images.image', 'mock/painter-1')
    expect(useModelChoicesStore.getState().choices['images.image']).toBe(
      'mock/painter-1',
    )
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
        string,
        string
      >,
    ).toEqual({ 'images.image': 'mock/painter-1' })
  })

  it('null forgets the slot', () => {
    const { remember } = useModelChoicesStore.getState()
    remember('audio.tts', 'tts-1')
    remember('audio.tts', null)
    expect(useModelChoicesStore.getState().choices['audio.tts']).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{}')
  })

  it('loadStoredChoices reads back only string entries and never throws', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ good: 'model-1', bad: 7, worse: { nested: true } }),
    )
    expect(loadStoredChoices()).toEqual({ good: 'model-1' })

    localStorage.setItem(STORAGE_KEY, 'not json at all')
    expect(loadStoredChoices()).toEqual({})

    localStorage.setItem(STORAGE_KEY, JSON.stringify(['array']))
    expect(loadStoredChoices()).toEqual({})
  })
})
