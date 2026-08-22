import { useState } from 'react'
import type { TextModel } from '../api/nanogpt'
import { scriptSystemPrompt, scriptUserPrompt } from '../domain/prompts'
import {
  estimateChatCostUsd,
  SCRIPT_OUTPUT_TOKEN_BUDGET,
} from '../lib/costEstimate'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'
import { ConfirmDialog } from './ConfirmDialog'
import { TextModelPicker } from './ModelPicker'

export function ScriptStage() {
  const project = useProjectStore((s) => s.project)
  const updateScriptText = useProjectStore((s) => s.updateScriptText)
  const flushProject = useProjectStore((s) => s.flushProject)
  const setScriptLocked = useProjectStore((s) => s.setScriptLocked)
  const generateScript = useProjectStore((s) => s.generateScript)
  const genStatus = useProjectStore((s) => s.scriptGenStatus)
  const genError = useProjectStore((s) => s.scriptGenError)

  const [model, setModel] = useState<TextModel | null>(null)
  const [instructions, setInstructions] = useState('')
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false)
  const [confirmingUnlock, setConfirmingUnlock] = useState(false)

  if (project === null) return null
  const { script } = project

  const estimatedUsd =
    model === null
      ? null
      : estimateChatCostUsd({
          promptText: `${scriptSystemPrompt()}\n${scriptUserPrompt(instructions)}`,
          outputTokenBudget: SCRIPT_OUTPUT_TOKEN_BUDGET,
          promptPricePerMTok: model.promptPricePerMTok,
          completionPricePerMTok: model.completionPricePerMTok,
        })

  const canGenerate =
    model !== null &&
    instructions.trim().length > 0 &&
    genStatus !== 'generating' &&
    !script.locked

  const runGeneration = () => {
    if (model === null) return
    void generateScript(model, instructions.trim())
  }

  return (
    <section style={{ maxWidth: '64rem', margin: '0 auto' }}>
      <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Script</h3>

      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <textarea
          value={script.text}
          onChange={(e) => {
            updateScriptText(e.target.value)
          }}
          onBlur={() => void flushProject()}
          disabled={script.locked}
          placeholder="Write your narration script here, or generate one below."
          aria-label="Script text"
          rows={10}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.6,
          }}
        />
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            margin: 'var(--space-2) 0 var(--space-3)',
          }}
        >
          {script.locked
            ? 'Script is locked — it is the basis for the scene breakdown.'
            : 'Autosaves as you type. Lock it when you are happy with it.'}{' '}
          {script.text.length > 0 &&
            `${String(script.text.length)} characters.`}
        </p>

        {script.locked ? (
          <button
            type="button"
            onClick={() => {
              setConfirmingUnlock(true)
            }}
          >
            Unlock script
          </button>
        ) : (
          <button
            type="button"
            disabled={script.text.trim().length === 0}
            onClick={() => void setScriptLocked(true)}
          >
            Lock script
          </button>
        )}
      </div>

      {!script.locked && (
        <div
          className="card"
          style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-4)',
          }}
        >
          <h4 style={{ marginTop: 0 }}>Generate with AI</h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <textarea
              value={instructions}
              onChange={(e) => {
                setInstructions(e.target.value)
              }}
              placeholder="What should the video be about? Topic, angle, tone…"
              aria-label="Generation instructions"
              rows={3}
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
              }}
            />
            <TextModelPicker
              selectedId={model?.id ?? null}
              onSelect={setModel}
            />
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
                disabled={!canGenerate}
                onClick={() => {
                  if (script.text.trim().length > 0) {
                    setConfirmingOverwrite(true)
                  } else {
                    runGeneration()
                  }
                }}
              >
                {genStatus === 'generating' ? 'Generating…' : 'Generate script'}
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
            {genStatus === 'error' && genError !== null && (
              <p role="alert" style={{ color: 'var(--color-danger)' }}>
                {genError}
              </p>
            )}
          </div>
        </div>
      )}

      {confirmingOverwrite && (
        <ConfirmDialog
          title="Replace the current script?"
          message="Generating will replace the text already in the editor. This cannot be undone."
          confirmLabel="Replace and generate"
          onConfirm={() => {
            setConfirmingOverwrite(false)
            runGeneration()
          }}
          onCancel={() => {
            setConfirmingOverwrite(false)
          }}
        />
      )}
      {confirmingUnlock && (
        <ConfirmDialog
          title="Unlock the script?"
          message="Scenes, images and clips built from this script will need to be redone if you change it."
          confirmLabel="Unlock"
          onConfirm={() => {
            setConfirmingUnlock(false)
            void setScriptLocked(false)
          }}
          onCancel={() => {
            setConfirmingUnlock(false)
          }}
        />
      )}
    </section>
  )
}
