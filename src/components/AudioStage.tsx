import { useState, type CSSProperties } from 'react'
import type { TtsModel } from '../api/nanogpt'
import { ttsCostUsd, ttsPriceNote, ttsSpeedRange } from '../domain/ttsModels'
import type { Scene } from '../domain/types'
import { formatUsd } from '../lib/format'
import { useModelsStore } from '../state/models'
import { useProjectStore } from '../state/project'
import { GenerationHistory } from './GenerationHistory'
import { TtsModelPicker } from './ModelPicker'
import { ReelShell } from './Reel'
import { useBlobUrl } from './useBlobUrl'
import { VoicePicker } from './VoicePicker'

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

  const ttsModels = useModelsStore((s) => s.ttsModels)
  const [modelId, setModelId] = useState<string | null>(null)
  const model: TtsModel | null = ttsModels.find((m) => m.id === modelId) ?? null
  const [voice, setVoice] = useState<string>('')
  const [speed, setSpeed] = useState(1)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
  const selectedScene =
    scenes.find((s) => s.id === selectedSceneId) ?? scenes[0] ?? null

  const pending = scenes
    .filter((s) => s.audioVersions.length === 0)
    .filter((s) => s.textExcerpt.trim().length > 0)
  const perSceneUsd =
    model === null
      ? []
      : pending.map((s) => ttsCostUsd(model, s.textExcerpt.trim()))
  const allExactUsd =
    model === null || perSceneUsd.some((c) => c === null)
      ? null
      : perSceneUsd.reduce((sum: number, c) => sum + (c ?? 0), 0)

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
            setVoice(m.voices[0] ?? '')
            setSpeed(1) // each model's pace starts neutral
          }}
          voice={voice}
          onSelectVoice={setVoice}
          speed={speed}
          onSelectSpeed={setSpeed}
          pendingCount={pending.length}
          allExactUsd={allExactUsd}
          allAudioProgress={allAudioProgress}
          onGenerateAll={() => {
            if (model !== null) void generateAllAudio(model, voice, speed)
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
  speed,
  onSelectSpeed,
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
  speed: number
  onSelectSpeed: (s: number) => void
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
  const activeUrl = useBlobUrl(
    activeVersion?.blobPath ?? null,
    activeVersion?.mimeType,
  )

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
            {text.length} characters.{' '}
            {model === null
              ? 'TTS is billed by character, so the price shown is exact — not an estimate.'
              : ttsPriceNote(model.pricing)}
          </p>
        )}
      </div>

      {/* Voice panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Narrate</div>
        <TtsModelPicker
          selectedId={model?.id ?? null}
          onSelect={onSelectModel}
        />
        {model !== null && model.voices.length > 0 && (
          <VoicePicker model={model} voice={voice} onSelect={onSelectVoice} />
        )}
        {model !== null &&
          (() => {
            const range = ttsSpeedRange(model.id)
            if (range === null) {
              return (
                <span
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Speed fixed by model
                </span>
              )
            }
            return (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>
                  Speed {speed.toFixed(2).replace(/\.?0+$/, '')}×
                </span>
                <input
                  type="range"
                  aria-label="Narration speed"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={speed}
                  onChange={(e) => {
                    onSelectSpeed(Number(e.target.value))
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </label>
            )
          })()}
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
                void generateSceneAudio(
                  scene.id,
                  model,
                  voice,
                  undefined,
                  speed,
                )
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
            {model === null
              ? 'Pick a model to see the price.'
              : exactUsd === null
                ? 'Price varies — charged at submission.'
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
              {model === null
                ? 'Pick a model to see the total.'
                : allExactUsd === null
                  ? 'Prices vary — charged at submission.'
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
              void generateSceneAudio(
                scene.id,
                model,
                voice,
                narrationText,
                speed,
              )
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
