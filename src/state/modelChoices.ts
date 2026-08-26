import { useCallback } from 'react'
import { create } from 'zustand'

/**
 * Remembered picker choices (22.12, Angel's report): every stage held its
 * model selection in component useState, so leaving a stage unmounted it
 * and threw the choice away — travel Images → Audio → Images and the
 * model had to be picked again. Choices now live here, keyed by a picker
 * slot ("images.image", "audio.tts", …), mirrored to localStorage so they
 * also survive reloads. Only IDs are stored; each stage re-resolves them
 * against the live catalog, so a model that vanished simply comes back
 * unselected.
 */

const STORAGE_KEY = 'kairo.modelChoices'

export function loadStoredChoices(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    // Storage unavailable or corrupted — start fresh, never crash.
    return {}
  }
}

interface ModelChoicesState {
  choices: Record<string, string>
  remember: (slot: string, value: string | null) => void
}

export const useModelChoicesStore = create<ModelChoicesState>((set, get) => ({
  choices: loadStoredChoices(),
  remember: (slot, value) => {
    const next = { ...get().choices }
    if (value === null) {
      delete next[slot]
    } else {
      next[slot] = value
    }
    set({ choices: next })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private mode etc. — the choice still holds for this session.
    }
  },
}))

/** A remembered plain value (voice name, model id) for one picker slot. */
export function useRememberedChoice(
  slot: string,
): [string | null, (value: string | null) => void] {
  const value = useModelChoicesStore((s) => s.choices[slot] ?? null)
  const remember = useModelChoicesStore((s) => s.remember)
  const setValue = useCallback(
    (v: string | null) => {
      remember(slot, v)
    },
    [remember, slot],
  )
  return [value, setValue]
}

/**
 * A remembered MODEL choice: stores the id, resolves it against the live
 * catalog every render. Drop-in for `useState<M | null>(null)` at picker
 * sites — same [model, pick] shape.
 */
export function useRememberedModel<M extends { id: string }>(
  slot: string,
  models: M[],
): [M | null, (model: M) => void] {
  const [id, setId] = useRememberedChoice(slot)
  const selected = models.find((m) => m.id === id) ?? null
  const pick = useCallback(
    (model: M) => {
      setId(model.id)
    },
    [setId],
  )
  return [selected, pick]
}
