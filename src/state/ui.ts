import { create } from 'zustand'
import type { Stage } from '../domain/stages'

/**
 * Cross-stage UI state (22.14, Angel's request): the stage lived in
 * ProjectView's useState, so no stage could send the user anywhere — but
 * "Save image as reference" wants a one-click jump to the Scenes page
 * with the new reference spotlighted so it gets its description.
 */
interface UiState {
  stage: Stage
  setStage: (stage: Stage) => void
  /**
   * Reference to spotlight after a cross-stage jump: the References
   * panel scrolls it into view with the attention pulse, then clears.
   */
  highlightReferenceId: string | null
  setHighlightReference: (id: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  stage: 'script',
  setStage: (stage) => {
    set({ stage })
  },
  highlightReferenceId: null,
  setHighlightReference: (id) => {
    set({ highlightReferenceId: id })
  },
}))
