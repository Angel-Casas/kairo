import { useState } from 'react'
import type { TextModel } from '../api/nanogpt'
import {
  sceneBreakdownSystemPrompt,
  sceneBreakdownUserPrompt,
} from '../domain/prompts'
import type { Scene } from '../domain/types'
import {
  estimateChatCostUsd,
  SCENES_OUTPUT_TOKEN_BUDGET,
} from '../lib/costEstimate'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'
import { ConfirmDialog } from './ConfirmDialog'
import { FilmProgress } from './FilmProgress'
import { TextModelPicker } from './ModelPicker'
import { ReferencesPanel } from './ReferencesPanel'
import { referenceDisplayName } from './referenceDisplay'

export function ScenesStage() {
  const project = useProjectStore((s) => s.project)
  const addScene = useProjectStore((s) => s.addScene)
  const generateScenes = useProjectStore((s) => s.generateScenes)
  const genStatus = useProjectStore((s) => s.scenesGenStatus)
  const genError = useProjectStore((s) => s.scenesGenError)

  const [model, setModel] = useState<TextModel | null>(null)
  const [confirmingReplace, setConfirmingReplace] = useState(false)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)

  const estimatedUsd =
    model === null
      ? null
      : estimateChatCostUsd({
          promptText: `${sceneBreakdownSystemPrompt()}\n${sceneBreakdownUserPrompt(project.script.text)}`,
          outputTokenBudget: SCENES_OUTPUT_TOKEN_BUDGET,
          promptPricePerMTok: model.promptPricePerMTok,
          completionPricePerMTok: model.completionPricePerMTok,
        })

  const runGeneration = () => {
    if (model === null) return
    void generateScenes(model)
  }

  return (
    <section>
      <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Scenes</h3>

      <ReferencesPanel />

      {scenes.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No scenes yet. Generate a breakdown below or add scenes manually. Aim
          for 5–10 scenes for a short.
        </p>
      ) : (
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(26rem, 1fr))',
            gap: 'var(--space-3)',
            alignItems: 'start',
          }}
        >
          {scenes.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={index}
              count={scenes.length}
            />
          ))}
        </ol>
      )}
      <button type="button" onClick={() => void addScene()}>
        Add scene
      </button>

      <div
        className="card"
        style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-4)',
        }}
      >
        <h4 style={{ marginTop: 0 }}>Break into scenes with AI</h4>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <TextModelPicker selectedId={model?.id ?? null} onSelect={setModel} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <button
              type="button"
              className="primary"
              disabled={model === null || genStatus === 'generating'}
              onClick={() => {
                if (scenes.length > 0) {
                  setConfirmingReplace(true)
                } else {
                  runGeneration()
                }
              }}
            >
              {genStatus === 'generating' ? 'Generating…' : 'Generate scenes'}
            </button>
            <span
              aria-label="Estimated cost"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {model === null
                ? 'Pick a model to see the estimated cost.'
                : estimatedUsd === null
                  ? 'Cost unknown for this model.'
                  : `Estimated cost: up to ~${formatUsd(estimatedUsd)}`}
            </span>
          </div>
          {genStatus === 'generating' && (
            <FilmProgress label="Scene breakdown generating" />
          )}
          {genStatus === 'error' && genError !== null && (
            <p role="alert" style={{ color: 'var(--color-danger)' }}>
              {genError}
            </p>
          )}
        </div>
      </div>

      {confirmingReplace && (
        <ConfirmDialog
          title="Replace the current scenes?"
          message="Generating a new breakdown will replace all existing scenes and their descriptions. This cannot be undone."
          confirmLabel="Replace and generate"
          onConfirm={() => {
            setConfirmingReplace(false)
            runGeneration()
          }}
          onCancel={() => {
            setConfirmingReplace(false)
          }}
        />
      )}
    </section>
  )
}

function SceneCard({
  scene,
  index,
  count,
}: {
  scene: Scene
  index: number
  count: number
}) {
  const updateScene = useProjectStore((s) => s.updateScene)
  const flushProject = useProjectStore((s) => s.flushProject)
  const removeScene = useProjectStore((s) => s.removeScene)
  const moveScene = useProjectStore((s) => s.moveScene)
  const references = useProjectStore((s) => s.project?.references ?? [])
  const toggleSceneReference = useProjectStore((s) => s.toggleSceneReference)

  return (
    <li
      aria-label={`Scene ${String(index + 1)}`}
      className="card"
      style={{
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <strong>Scene {index + 1}</strong>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          disabled={index === 0}
          aria-label={`Move scene ${String(index + 1)} up`}
          onClick={() => void moveScene(scene.id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          aria-label={`Move scene ${String(index + 1)} down`}
          onClick={() => void moveScene(scene.id, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          aria-label={`Delete scene ${String(index + 1)}`}
          onClick={() => void removeScene(scene.id)}
        >
          Delete
        </button>
      </div>
      <label style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
        <span
          style={{
            display: 'block',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Script excerpt
        </span>
        <textarea
          value={scene.textExcerpt}
          onChange={(e) => {
            updateScene(scene.id, { textExcerpt: e.target.value })
          }}
          onBlur={() => void flushProject()}
          aria-label={`Scene ${String(index + 1)} script excerpt`}
          rows={2}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
          }}
        />
      </label>
      <label style={{ display: 'block' }}>
        <span
          style={{
            display: 'block',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Visual description (image prompt basis)
        </span>
        <textarea
          value={scene.visualDescription}
          onChange={(e) => {
            updateScene(scene.id, { visualDescription: e.target.value })
          }}
          onBlur={() => void flushProject()}
          aria-label={`Scene ${String(index + 1)} visual description`}
          rows={2}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
          }}
        />
      </label>
      {references.length > 0 && (
        <fieldset
          style={{
            border: 'none',
            padding: 0,
            margin: 'var(--space-2) 0 0',
          }}
        >
          <legend
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              padding: 0,
              marginBottom: 'var(--space-1)',
            }}
          >
            References used in this scene
          </legend>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            {references.map((reference) => (
              <label
                key={reference.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <input
                  type="checkbox"
                  checked={scene.referenceIds.includes(reference.id)}
                  onChange={() =>
                    void toggleSceneReference(scene.id, reference.id)
                  }
                  aria-label={`Scene ${String(index + 1)} uses ${referenceDisplayName(reference)}`}
                />
                {referenceDisplayName(reference)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </li>
  )
}
