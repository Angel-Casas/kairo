import { useRef, useState } from 'react'
import type { TextModel } from '../api/nanogpt'
import {
  styleFromImageSystemPrompt,
  styleFromImageUserText,
} from '../domain/prompts'
import {
  estimateChatCostUsd,
  STYLE_FROM_IMAGE_OUTPUT_TOKEN_BUDGET,
} from '../lib/costEstimate'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'
import { ConfirmDialog } from './ConfirmDialog'
import { TextModelPicker } from './ModelPicker'

/**
 * Style-from-image (Slice 12): pick a local image, let a vision model name
 * its palette, light, medium, and composition, and use the result as the
 * project's style notes. The image is sent to NanoGPT only.
 */
export function StyleFromImage() {
  const project = useProjectStore((s) => s.project)
  const describeStyleFromImage = useProjectStore(
    (s) => s.describeStyleFromImage,
  )
  const updateStyleNotes = useProjectStore((s) => s.updateStyleNotes)
  const flushProject = useProjectStore((s) => s.flushProject)
  const status = useProjectStore((s) => s.styleFromImageStatus)
  const error = useProjectStore((s) => s.styleFromImageError)

  const [model, setModel] = useState<TextModel | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [proposal, setProposal] = useState<string | null>(null)
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (project === null) return null

  const generating = status === 'generating'
  const estimatedUsd =
    model === null
      ? null
      : estimateChatCostUsd({
          promptText: `${styleFromImageSystemPrompt()}\n${styleFromImageUserText()}`,
          outputTokenBudget: STYLE_FROM_IMAGE_OUTPUT_TOKEN_BUDGET,
          promptPricePerMTok: model.promptPricePerMTok,
          completionPricePerMTok: model.completionPricePerMTok,
        })

  const applyProposal = () => {
    if (proposal === null) return
    updateStyleNotes(proposal.trim())
    void flushProject()
    setProposal(null)
  }

  return (
    <details
      style={{
        marginTop: 'var(--space-3)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 'var(--space-3)',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 'var(--text-base)',
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        Describe a style from an image
      </summary>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-3)',
        }}
      >
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            margin: 0,
          }}
        >
          Pick an image whose look you want to copy. A vision model names its
          palette, lighting, medium, and composition — style only, never the
          subject — and the result becomes your style notes. The image is sent
          only to NanoGPT.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Style reference image file"
            style={{ display: 'none' }}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          <button
            type="button"
            disabled={generating}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose image
          </button>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {file === null ? 'No image chosen.' : file.name}
          </span>
        </div>

        <TextModelPicker
          selectedId={model?.id ?? null}
          onSelect={setModel}
          onlyVision
          ariaLabel="Vision model"
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            disabled={model === null || file === null || generating}
            onClick={() => {
              if (model !== null && file !== null) {
                void describeStyleFromImage(model, file).then((result) => {
                  if (result !== null) setProposal(result)
                })
              }
            }}
          >
            {generating ? 'Describing…' : 'Describe style'}
          </button>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {model === null
              ? 'Pick a vision-capable model to see the estimated cost.'
              : estimatedUsd === null
                ? 'Cost unknown for this model; the actual amount is recorded in the spend log.'
                : `Estimated cost: up to ~${formatUsd(estimatedUsd)} for the text, plus the image input, which varies by model. The actual amount is recorded in the spend log.`}
          </span>
        </div>

        {status === 'error' && error !== null && (
          <p role="alert" style={{ color: 'var(--color-danger)', margin: 0 }}>
            {error}
          </p>
        )}

        {proposal !== null && (
          <div>
            <label style={{ display: 'block' }}>
              <span
                style={{
                  display: 'block',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Proposed style notes (edit before applying)
              </span>
              <textarea
                value={proposal}
                onChange={(e) => {
                  setProposal(e.target.value)
                }}
                aria-label="Proposed style notes"
                rows={3}
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
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-1)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (project.styleNotes.trim().length > 0) {
                    setConfirmingReplace(true)
                  } else {
                    applyProposal()
                  }
                }}
              >
                Use as style notes
              </button>
              <button
                type="button"
                onClick={() => {
                  setProposal(null)
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmingReplace && (
        <ConfirmDialog
          title="Replace the current style notes?"
          message="Your existing style notes will be replaced by the proposed ones. This cannot be undone."
          confirmLabel="Replace notes"
          onConfirm={() => {
            setConfirmingReplace(false)
            applyProposal()
          }}
          onCancel={() => {
            setConfirmingReplace(false)
          }}
        />
      )}
    </details>
  )
}
