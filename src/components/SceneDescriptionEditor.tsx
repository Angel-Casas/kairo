import type { Scene } from '../domain/types'
import { useT } from '../i18n'
import { useProjectStore } from '../state/project'

/**
 * The scene's visual description, always editable in place (22.1 — the
 * Edit/Save/Cancel modes made the recipe feel scrambled next to the
 * always-on fields; one grammar now: every editable ingredient is a
 * plain textarea that saves as you type, exactly like camera notes and
 * style notes). The text is the same one Scenes owns — `updateScene`
 * persists it and every stage sees it at once. Already-generated takes
 * keep the prompts they were made with (append-only history); only
 * future generations pick up the edit.
 */
export function SceneDescriptionEditor({
  scene,
  n,
}: {
  scene: Scene
  /** 1-based scene number as a string, for labels. */
  n: string
}) {
  const t = useT()
  const updateScene = useProjectStore((s) => s.updateScene)

  return (
    <>
      <textarea
        aria-label={`Scene ${n} prompt editor`}
        value={scene.visualDescription}
        placeholder={t(
          'Describe the shot — subject, setting, mood. Add it here or on the Scenes stage.',
        )}
        rows={3}
        onChange={(e) => {
          updateScene(scene.id, { visualDescription: e.target.value })
        }}
        style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <p
        style={{
          margin: 'var(--space-1) 0 0',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
        }}
      >
        {t(
          'Saves as you type — Scenes, Images and Animation all see it. Existing takes keep the prompt they were made with.',
        )}
      </p>
    </>
  )
}
