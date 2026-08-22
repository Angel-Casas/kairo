import { useState } from 'react'
import type { Scene } from '../domain/types'
import { useProjectStore } from '../state/project'

/**
 * The scene's visual description, editable in place (Slice 15.7): the same
 * text that Scenes owns, shown on the Images and Animation workbenches with
 * an Edit button so a tweak doesn't require walking back a stage. Saving
 * goes through `updateScene`, so the change persists and shows on every
 * stage at once. Already-generated takes keep the prompts they were made
 * with (append-only history); only future generations pick up the edit.
 */
export function SceneDescriptionEditor({
  scene,
  n,
}: {
  scene: Scene
  /** 1-based scene number as a string, for labels. */
  n: string
}) {
  const updateScene = useProjectStore((s) => s.updateScene)
  const [draft, setDraft] = useState<string | null>(null)

  const hasDescription = scene.visualDescription.trim().length > 0

  if (draft === null) {
    return (
      <>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          {hasDescription
            ? scene.visualDescription
            : 'No visual description — add one on the Scenes stage, or edit it right here.'}
        </p>
        <div>
          <button
            type="button"
            aria-label={`Edit scene ${n} prompt`}
            onClick={() => {
              setDraft(scene.visualDescription)
            }}
            style={{
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-1) var(--space-3)',
            }}
          >
            Edit prompt
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <textarea
        aria-label={`Scene ${n} prompt editor`}
        value={draft}
        rows={5}
        onChange={(e) => {
          setDraft(e.target.value)
        }}
        style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="primary"
          aria-label={`Save scene ${n} prompt`}
          onClick={() => {
            updateScene(scene.id, { visualDescription: draft })
            setDraft(null)
          }}
          style={{
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-1) var(--space-3)',
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(null)
          }}
          style={{
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-1) var(--space-3)',
          }}
        >
          Cancel
        </button>
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Saves to the scene itself — Scenes, Images and Animation all see it.
          Existing takes keep the prompt they were made with.
        </span>
      </div>
    </>
  )
}
