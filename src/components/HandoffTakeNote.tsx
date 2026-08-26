import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { useProjectStore } from '../state/project'
import type { Scene } from '../domain/types'

/**
 * The carried-in-frame notice (21.2): whenever a scene's ACTIVE image is
 * a handoff frame, say so and offer the way back — in BOTH places the
 * user meets that image: the Images stage takes panel and the Animation
 * workbench (where the carry button lives, so the undo lives there too —
 * Angel's call). Renders nothing when the active take isn't a handoff.
 */
export function HandoffTakeNote({ scene }: { scene: Scene }) {
  const removeFreeSceneImageVersion = useProjectStore(
    (s) => s.removeFreeSceneImageVersion,
  )
  const [confirming, setConfirming] = useState(false)

  const activeImage =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const activeHandoff =
    activeImage !== null &&
    activeImage.model === 'handoff-frame' &&
    activeImage.costUsd === null
      ? activeImage
      : null
  if (activeHandoff === null) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
        }}
      >
        The active take is a carried-in frame
        {activeHandoff.prompt.length > 0
          ? ` (${activeHandoff.prompt.toLowerCase()})`
          : ''}
        .
      </span>
      <button
        type="button"
        onClick={() => {
          setConfirming(true)
        }}
        style={{
          fontSize: 'var(--text-sm)',
          padding: 'var(--space-1) var(--space-3)',
        }}
      >
        Remove handoff frame
      </button>
      {confirming && (
        <ConfirmDialog
          title="Remove the handoff frame?"
          message={
            scene.imageVersions.length > 1
              ? 'The previous take becomes the active image again. The frame was free, and you can carry it in again any time.'
              : 'The scene returns to having no image. The frame was free, and you can carry it in again any time.'
          }
          confirmLabel="Remove handoff frame"
          onConfirm={() => {
            setConfirming(false)
            void removeFreeSceneImageVersion(scene.id, activeHandoff.id)
          }}
          onCancel={() => {
            setConfirming(false)
          }}
        />
      )}
    </div>
  )
}
