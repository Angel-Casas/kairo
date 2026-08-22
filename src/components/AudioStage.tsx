import { useState, type CSSProperties } from 'react'
import { TTS_MODELS, ttsCostUsd, type TtsModel } from '../domain/ttsModels'
import type { Scene } from '../domain/types'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'
import { GenerationHistory } from './GenerationHistory'
import { ReelShell } from './Reel'
import { useBlobUrl } from './useBlobUrl'

/**
 * The Audio stage (Slice 15): narrate each scene's script excerpt with TTS.
 * Same reel + workbench shape as Images/Animation; frames are text cards
 * until the Images stage gives the scenes faces. TTS is billed by input
 * characters, so every price shown here is EXACT — the one generation kind
 * with no "~" anywhere.
 */
export function AudioStage() {
  const project = useProjectStore((s) => s.project)
  const generateAllAudio = useProjectStore((s) => s.generateAllAudio)
  const allAudioProgress = useProjectStore((s) => s.allAudioProgress)

  const [modelId, setModelId] = useState<string>(TTS_MODELS[0]?.id ?? '')
  const model: TtsModel | null =
    TTS_MODELS.find((m) => m.id === modelId) ?? null
  const [voice, setVoice] = useState<string>(TTS_MODELS[0]?.voices[0]?.id ?? '')
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
  const selectedScene =
    scenes.find((s) => s.id === selectedSceneId) ?? scenes[0] ?? null

  const pending = scenes
    .filter((s) => s.audioVersions.length === 0)
    .filter((s) => s.textExcerpt.trim().length > 0)
  const allExactUsd =
    model === null
      ? null
      : pending.reduce(
          (sum, s) => sum + ttsCostUsd(model, s.textExcerpt.trim()),
          0,
        )

  if (scenes.length === 0) {
    return (
      <section>
        <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Audio</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>
          No scenes yet — build the scene breakdown first.
        </p>
      </section>
    )
  }

  return (
    <section>
      <ReelShell hint="select a frame to narrate it below">
        {scenes.map((scene, index) => (
          <AudioFrame
            key={scene.id}
            scene={scene}
            index={index}
            selected={selectedScene?.id === scene.id}
            onSelect={() => {
              setSelectedSceneId(scene.id)
            }}
          />
        ))}
      </ReelShell>

      {selectedScene !== null && (
        <AudioWorkbench
          key={selectedScene.id}
          scene={selectedScene}
          index={scenes.findIndex((s) => s.id === selectedScene.id)}
          model={model}
          onSelectModel={(m) => {
            setModelId(m.id)
            setVoice(m.voices[0]?.id ?? '')
          }}
          voice={voice}
          onSelectVoice={setVoice}
          pendingCount={pending.length}
          allExactUsd={allExactUsd}
          allAudioProgress={allAudioProgress}
          onGenerateAll={() => {
            if (model !== null) void generateAllAudio(model, voice)
          }}
        />
      )}
    </section>
  )
}

function AudioFrame({
  scene,
  index,
  selected,
  onSelect,
}: {
  scene: Scene
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const status = useProjectStore((s) => s.sceneAudioStatus[scene.id])
  const generating = status?.generating === true
  const narrated = scene.audioVersions.length > 0
  const n = String(index + 1)
  const excerpt = scene.textExcerpt.trim()

  return (
    <button
      type="button"
      aria-label={`Scene ${n} frame`}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        padding: 'var(--space-3)',
        flexShrink: 0,
        width: selected ? '13rem' : '11.5rem',
        minHeight: '11rem',
        borderRadius: '16px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--space-2)',
        textAlign: 'left',
        border: selected
          ? '2px solid var(--color-accent)'
          : narrated
            ? '1px solid var(--color-border)'
            : '1px dashed var(--color-border)',
        boxShadow: selected
          ? '0 0 0 5px var(--color-accent-soft), var(--shadow-card)'
          : 'none',
        background: 'var(--color-surface)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: narrated ? 'var(--color-accent)' : 'var(--color-text-muted)',
        }}
      >
        {n} ·{' '}
        {generating
          ? 'narrating…'
          : narrated
            ? `♪ narrated (${String(scene.audioVersions.length)})`
            : 'no narration'}
      </span>
      <span
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 400,
          lineHeight: 1.5,
          color:
            excerpt.length > 0
              ? 'var(--color-text)'
              : 'var(--color-text-muted)',
          display: '-webkit-box',
          WebkitLineClamp: 6,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {excerpt.length > 0
          ? excerpt
          : 'No script excerpt — add one on the Scenes stage.'}
      </span>
    </button>
  )
}

function AudioWorkbench({
  scene,
  index,
  model,
  onSelectModel,
  voice,
  onSelectVoice,
  pendingCount,
  allExactUsd,
  allAudioProgress,
  onGenerateAll,
}: {
  scene: Scene
  index: number
  model: TtsModel | null
  onSelectModel: (m: TtsModel) => void
  voice: string
  onSelectVoice: (v: string) => void
  pendingCount: number
  allExactUsd: number | null
  allAudioProgress: { done: number; total: number } | null
  onGenerateAll: () => void
}) {
  const generateSceneAudio = useProjectStore((s) => s.generateSceneAudio)
  const setActiveAudioVersion = useProjectStore((s) => s.setActiveAudioVersion)
  const status = useProjectStore((s) => s.sceneAudioStatus[scene.id])

  const n = String(index + 1)
  const generating = status?.generating === true
  const text = scene.textExcerpt.trim()
  const exactUsd = model === null ? null : ttsCostUsd(model, text)
  const activeVersion =
    scene.audioVersions.find((v) => v.id === scene.activeAudioVersionId) ?? null
  const activeUrl = useBlobUrl(activeVersion?.blobPath ?? null)

  const panel: CSSProperties = {
    padding: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    minWidth: 0,
  }
  const panelTitle: CSSProperties = {
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
  }

  return (
    <div
      aria-label={`Scene ${n} audio workbench`}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}
    >
      {/* Narration text panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Scene {n} — narration text</div>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          {text.length > 0
            ? `“${text}”`
            : 'No script excerpt — add one on the Scenes stage.'}
        </p>
        {text.length > 0 && (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
            }}
          >
            {text.length} characters. TTS is billed by character, so the price
            shown is exact — not an estimate.
          </p>
        )}
      </div>

      {/* Voice panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Narrate</div>
        <label>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              marginRight: 'var(--space-2)',
            }}
          >
            Model
          </span>
          <select
            aria-label="Narration model"
            value={model?.id ?? ''}
            onChange={(e) => {
              const next = TTS_MODELS.find((m) => m.id === e.target.value)
              if (next !== undefined) onSelectModel(next)
            }}
          >
            {TTS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {formatUsd(m.pricePerKChars)}/1k chars
              </option>
            ))}
          </select>
        </label>
        <label>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              marginRight: 'var(--space-2)',
            }}
          >
            Voice
          </span>
          <select
            aria-label="Voice"
            value={voice}
            onChange={(e) => {
              onSelectVoice(e.target.value)
            }}
          >
            {(model?.voices ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
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
            className="primary"
            disabled={
              model === null ||
              text.length === 0 ||
              generating ||
              allAudioProgress !== null
            }
            onClick={() => {
              if (model !== null) {
                void generateSceneAudio(scene.id, model, voice)
              }
            }}
          >
            {generating
              ? 'Narrating…'
              : scene.audioVersions.length > 0
                ? 'Re-narrate'
                : 'Narrate scene'}
          </button>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {model === null || exactUsd === null
              ? 'Pick a model to see the price.'
              : `Exact cost: ${formatUsd(exactUsd)}`}
          </span>
        </div>
        {status?.error != null && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}
        {pendingCount > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              disabled={model === null || allAudioProgress !== null}
              onClick={onGenerateAll}
            >
              {allAudioProgress !== null
                ? `Narrating ${String(allAudioProgress.done)}/${String(allAudioProgress.total)}…`
                : `Narrate ${String(pendingCount)} remaining ${pendingCount === 1 ? 'scene' : 'scenes'}`}
            </button>
            <span
              aria-label="Exact total cost"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {allExactUsd === null
                ? 'Pick a model to see the total.'
                : `Exact total: ${formatUsd(allExactUsd)}`}
            </span>
          </div>
        )}
      </div>

      {/* Takes panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Takes — scene {n}</div>
        {activeUrl !== null ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- generated narration; the text IS the caption, shown beside it
          <audio
            src={activeUrl}
            controls
            aria-label={`Scene ${n} narration`}
            style={{ width: '100%' }}
          />
        ) : (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No narration yet — the first take lands here.
          </p>
        )}
        {scene.audioVersions.length > 1 && (
          <div
            style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            {scene.audioVersions.map((version, vIndex) => (
              <button
                key={version.id}
                type="button"
                aria-label={`Scene ${n} take ${String(vIndex + 1)}`}
                aria-pressed={version.id === scene.activeAudioVersionId}
                onClick={() => void setActiveAudioVersion(scene.id, version.id)}
                style={{
                  border:
                    version.id === scene.activeAudioVersionId
                      ? '2px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                  background:
                    version.id === scene.activeAudioVersionId
                      ? 'var(--color-accent-soft)'
                      : 'var(--color-surface)',
                  color: 'var(--color-text)',
                  padding: 'var(--space-1) var(--space-3)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Take {vIndex + 1}
              </button>
            ))}
          </div>
        )}
        <GenerationHistory
          versions={scene.audioVersions}
          activeVersionId={scene.activeAudioVersionId}
          label={`Scene ${n} narration`}
          onRegenerate={(narrationText) => {
            if (model !== null) {
              void generateSceneAudio(scene.id, model, voice, narrationText)
            }
          }}
          regenerateDisabled={
            model === null || generating || allAudioProgress !== null
          }
          regenerateDisabledHint={
            model === null
              ? 'Pick a narration model first.'
              : 'Another narration is running.'
          }
          regenerateCostText="Billed by character count — editing the text changes the exact price accordingly."
          editorHint="This exact text will be narrated — nothing is added or removed."
        />
      </div>
    </div>
  )
}
