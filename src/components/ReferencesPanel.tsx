import { useEffect, useRef, useState } from 'react'
import type { ImageModel, TextModel } from '../api/nanogpt'
import type { ReferenceAsset, ReferenceKind } from '../domain/types'
import {
  describeReferenceSystemPrompt,
  describeReferenceUserText,
} from '../domain/prompts'
import {
  DESCRIBE_REFERENCE_OUTPUT_TOKEN_BUDGET,
  estimateChatCostUsd,
} from '../lib/costEstimate'
import { formatUsd } from '../lib/format'
import {
  getPerImagePriceUsd,
  pickResolutionForRatio,
  resolutionLabel,
} from '../lib/resolution'
import { useFormatSpec } from './useFormatSpec'
import { useModelsStore } from '../state/models'
import { useProjectStore } from '../state/project'
import { useRememberedModel } from '../state/modelChoices'
import { useUiStore } from '../state/ui'
import { ConfirmDialog } from './ConfirmDialog'
import { DevelopingVeil } from './DevelopingVeil'
import { FilmProgress } from './FilmProgress'
import { GenerationHistory } from './GenerationHistory'
import { Lightbox, type LightboxItem } from './Lightbox'
import { ImageModelPicker, TextModelPicker } from './ModelPicker'
import { referenceDisplayName } from './referenceDisplay'
import { useBlobUrl } from './useBlobUrl'
import { VersionThumb } from './VersionThumb'

const KIND_LABELS: Record<ReferenceKind, string> = {
  character: 'Character',
  location: 'Location',
  style: 'Art style',
}

/**
 * Project references (Slice 10): characters, locations, and art styles that
 * scenes opt into for cross-scene consistency. Descriptors are injected
 * verbatim into the image prompts of the scenes that tick them.
 */
export function ReferencesPanel() {
  const formatSpec = useFormatSpec()
  const project = useProjectStore((s) => s.project)
  const addReference = useProjectStore((s) => s.addReference)

  const imageModels = useModelsStore((s) => s.imageModels)
  const textModels = useModelsStore((s) => s.textModels)
  // Remembered across stage hops and reloads (22.12).
  const [model, setModel] = useRememberedModel<ImageModel>(
    'references.image',
    imageModels,
  )
  const [resolution, setResolution] = useState<string | null>(null)
  // The describe model (22.3.2): a TEXT model that accepts image input.
  // Chosen once, shared by every card — but the picker lives inline next
  // to each card's Describe button (Angel: a panel-level collapsed row
  // was invisible; the picker belongs where it is used, even repeated).
  const [describeModel, setDescribeModel] = useRememberedModel<TextModel>(
    'references.describe',
    textModels,
  )
  const [lightboxStart, setLightboxStart] = useState<number | null>(null)
  // A cross-stage jump ("Describe it now" on Images, 22.14) spotlights
  // the reference it created.
  const highlightReferenceId = useUiStore((s) => s.highlightReferenceId)
  const setHighlightReference = useUiStore((s) => s.setHighlightReference)

  if (project === null) return null

  const effectiveResolution =
    model === null
      ? null
      : (resolution ?? pickResolutionForRatio(model, formatSpec.ratio))

  // Every reference with an active image — the lightbox walks this list
  // with the arrow keys, same as the scene reels (22.10).
  const lightboxItems: LightboxItem[] = []
  const lightboxIndexByReference = new Map<string, number>()
  for (const reference of project.references) {
    const active =
      reference.imageVersions.find(
        (v) => v.id === reference.activeImageVersionId,
      ) ?? null
    if (active !== null) {
      lightboxIndexByReference.set(reference.id, lightboxItems.length)
      lightboxItems.push({
        blobPath: active.blobPath,
        mimeType: active.mimeType,
        alt: `Reference ${referenceDisplayName(reference)} image — enlarged`,
        kind: 'image',
        title: referenceDisplayName(reference),
        prompt: reference.descriptor.trim(),
      })
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: 'var(--space-1)' }}>
        References
      </h4>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          marginTop: 0,
          marginBottom: 'var(--space-3)',
        }}
      >
        Define recurring characters, locations, or art styles once, then tick
        them on the scenes that use them. The description is added word for word
        to those scenes&apos; image prompts, so the same subject looks the same
        across scenes. Describe everything that must stay identical (face, hair,
        clothing, colors); a variant belongs in a separate reference.
      </p>

      {project.references.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {project.references.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              model={model}
              resolution={effectiveResolution}
              onPickModel={(m) => {
                setModel(m)
                setResolution(null)
              }}
              onPickResolution={setResolution}
              describeModel={describeModel}
              onPickDescribeModel={setDescribeModel}
              onExpand={() => {
                const at = lightboxIndexByReference.get(reference.id)
                if (at !== undefined) setLightboxStart(at)
              }}
              highlight={reference.id === highlightReferenceId}
              onHighlightDone={() => {
                setHighlightReference(null)
              }}
            />
          ))}
        </ul>
      )}

      {lightboxStart !== null && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          startIndex={lightboxStart}
          onClose={() => {
            setLightboxStart(null)
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {/* No "Add art style" here — the look of the project is managed by
            the Artistic style hub on the Images stage. Existing style
            references keep working (the kind dropdown still offers it). */}
        {(['character', 'location'] as ReferenceKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => void addReference(kind)}
          >
            Add {KIND_LABELS[kind].toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReferenceCard({
  reference,
  model,
  resolution,
  onPickModel,
  onPickResolution,
  describeModel,
  onPickDescribeModel,
  onExpand,
  highlight,
  onHighlightDone,
}: {
  reference: ReferenceAsset
  model: ImageModel | null
  resolution: string | null
  onPickModel: (model: ImageModel) => void
  onPickResolution: (resolution: string) => void
  describeModel: TextModel | null
  onPickDescribeModel: (model: TextModel) => void
  onExpand: () => void
  highlight: boolean
  onHighlightDone: () => void
}) {
  const formatSpec = useFormatSpec()
  const updateReference = useProjectStore((s) => s.updateReference)
  const removeReference = useProjectStore((s) => s.removeReference)
  const flushProject = useProjectStore((s) => s.flushProject)
  const importReferenceImage = useProjectStore((s) => s.importReferenceImage)
  const removeFreeReferenceImageVersion = useProjectStore(
    (s) => s.removeFreeReferenceImageVersion,
  )
  const generateReferenceImage = useProjectStore(
    (s) => s.generateReferenceImage,
  )
  const setActiveReferenceImageVersion = useProjectStore(
    (s) => s.setActiveReferenceImageVersion,
  )
  const status = useProjectStore((s) => s.referenceImageStatus[reference.id])
  const describeReferenceFromImage = useProjectStore(
    (s) => s.describeReferenceFromImage,
  )
  const describeStatus = useProjectStore(
    (s) => s.referenceDescribeStatus[reference.id],
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingDescribe, setConfirmingDescribe] = useState(false)
  const [confirmingRemoveImport, setConfirmingRemoveImport] = useState(false)
  const cardRef = useRef<HTMLLIElement>(null)

  // Land the cross-stage spotlight (22.14): scroll to the card, pulse a
  // few beats, then hand the spotlight back.
  useEffect(() => {
    if (!highlight) return
    cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const timer = setTimeout(onHighlightDone, 5000)
    return () => {
      clearTimeout(timer)
    }
  }, [highlight, onHighlightDone])
  /** Which way the card's Generate runs (22.7): text→image or image→text. */
  const [genMode, setGenMode] = useState<'image' | 'describe'>('image')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = referenceDisplayName(reference)
  const activeVersion =
    reference.imageVersions.find(
      (v) => v.id === reference.activeImageVersionId,
    ) ?? null
  const activeUrl = useBlobUrl(
    activeVersion?.blobPath ?? null,
    activeVersion?.mimeType,
  )
  const generating = status?.generating === true
  const describing = describeStatus?.generating === true
  const perImageUsd =
    model === null ? null : getPerImagePriceUsd(model, resolution)
  const describeUsd =
    describeModel === null
      ? null
      : estimateChatCostUsd({
          promptText: `${describeReferenceSystemPrompt(reference.kind)}\n${describeReferenceUserText(reference.kind)}`,
          outputTokenBudget: DESCRIBE_REFERENCE_OUTPUT_TOKEN_BUDGET,
          promptPricePerMTok: describeModel.promptPricePerMTok,
          completionPricePerMTok: describeModel.completionPricePerMTok,
        })

  const runDescribe = () => {
    if (describeModel !== null) {
      void describeReferenceFromImage(reference.id, describeModel)
    }
  }

  return (
    <li
      ref={cardRef}
      aria-label={`Reference ${displayName}`}
      className={highlight ? 'attention-pulse' : undefined}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ width: '6rem', flexShrink: 0 }}>
        {activeUrl !== null ? (
          <div
            className="frame-wrap"
            style={{
              position: 'relative',
              // The veil's ring traces this radius while the model works.
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}
            // Double-click enlarges, same as the scene reels (22.10.1).
            onDoubleClick={onExpand}
          >
            {(generating || describing) && <DevelopingVeil />}
            <img
              src={activeUrl}
              alt={`Reference image for ${displayName}`}
              style={{
                width: '100%',
                aspectRatio: formatSpec.cssAspect,
                objectFit: 'cover',
                borderRadius: 'var(--radius)',
                display: 'block',
              }}
            />
            {/* Imports are free, so they get a way out (22.8) — paid
                generations never show the X. */}
            {activeVersion !== null && activeVersion.costUsd === null && (
              <button
                type="button"
                aria-label={`Remove imported image for ${displayName}`}
                title="Remove this imported image"
                disabled={generating}
                onClick={() => {
                  setConfirmingRemoveImport(true)
                }}
                style={{
                  position: 'absolute',
                  top: 'var(--space-1)',
                  right: 'var(--space-1)',
                  width: '1.5rem',
                  height: '1.5rem',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  lineHeight: 1,
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                >
                  <path
                    d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            )}
            {/* Same enlarge control as the scene reels (22.10): fades
                in on hover, opens the fullscreen lightbox. */}
            <button
              type="button"
              className="expand-btn"
              aria-label={`View ${displayName} image large`}
              onClick={onExpand}
              style={{
                position: 'absolute',
                right: 'var(--space-1)',
                bottom: 'var(--space-1)',
                width: '26px',
                height: '26px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: '#ffffff',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                aria-hidden="true"
              >
                <path
                  d="M8 1.5 H11.5 V5 M11.5 1.5 L7.5 5.5 M5 11.5 H1.5 V8 M1.5 11.5 L5.5 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div
            aria-label={`Reference ${displayName} has no image yet`}
            style={{
              width: '100%',
              aspectRatio: formatSpec.cssAspect,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
              padding: 'var(--space-2)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {generating ? 'Generating…' : 'No image'}
            {generating && <DevelopingVeil />}
          </div>
        )}
        {/* Plain, free import lives with the image it fills (22.7). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label={`Import an image for ${displayName}`}
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file !== undefined) {
              void importReferenceImage(reference.id, file)
            }
            e.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={generating}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-1) var(--space-2)',
          }}
        >
          Import image
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <select
            aria-label={`Reference ${displayName} kind`}
            value={reference.kind}
            onChange={(e) => {
              updateReference(reference.id, {
                kind: e.target.value as ReferenceKind,
              })
            }}
            onBlur={() => void flushProject()}
          >
            {(Object.keys(KIND_LABELS) as ReferenceKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={reference.name}
            placeholder="Name (e.g. Captain Mara)"
            aria-label={`Reference ${displayName} name`}
            onChange={(e) => {
              updateReference(reference.id, { name: e.target.value })
            }}
            onBlur={() => void flushProject()}
            style={{
              flex: 1,
              minWidth: '10rem',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-2)',
            }}
          />
          <button
            type="button"
            aria-label={`Delete reference ${displayName}`}
            onClick={() => {
              setConfirmingDelete(true)
            }}
          >
            Delete
          </button>
        </div>
        <label style={{ display: 'block' }}>
          <span
            style={{
              display: 'block',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Description (added word for word to ticked scenes&apos; prompts)
          </span>
          <textarea
            value={reference.descriptor}
            onChange={(e) => {
              updateReference(reference.id, { descriptor: e.target.value })
            }}
            onBlur={() => void flushProject()}
            placeholder="e.g. a tall woman in her 40s with cropped silver hair, a scar over her left eyebrow, a navy-blue captain's coat with brass buttons"
            aria-label={`Reference ${displayName} description`}
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

        {/* One generation block (22.7, Angel's toggle): the direction
            switch decides what Generate does, and the single dropdown
            follows it — image models one way, text models that read
            images the other. Each direction remembers its own pick. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-2)',
          }}
        >
          <div
            role="group"
            className="seg-group"
            aria-label={`${displayName} generation direction`}
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              maxWidth: '100%',
              flexWrap: 'wrap',
              border: '1px solid var(--color-border)',
              // Pill, like every other button (22.9.1): a pill's corners
              // stay concentric with the hover ring at any offset, so
              // the ring matches the border instead of pinching.
              borderRadius: 'var(--radius-pill)',
              /* No overflow:hidden — it would clip the group's hover
                 ring; the segments round their own outer corners. */
            }}
          >
            {[
              {
                mode: 'image' as const,
                label: 'Generate image from description',
              },
              {
                mode: 'describe' as const,
                label: 'Generate description from image',
              },
            ].map(({ mode, label }, segIndex) => (
              <button
                key={mode}
                type="button"
                className="seg-option"
                aria-pressed={genMode === mode}
                aria-label={`${label} for ${displayName}`}
                onClick={() => {
                  setGenMode(mode)
                }}
                style={{
                  border: 'none',
                  // Outer corners follow the group's pill rounding (the
                  // group no longer clips — its hover ring must show).
                  borderRadius:
                    segIndex === 0
                      ? 'var(--radius-pill) 0 0 var(--radius-pill)'
                      : '0 var(--radius-pill) var(--radius-pill) 0',
                  boxShadow: 'none',
                  fontSize: 'var(--text-sm)',
                  // Pill ends need a touch more room so the text clears
                  // the curve.
                  padding: 'var(--space-2) var(--space-4)',
                  fontWeight: genMode === mode ? 700 : 400,
                  background:
                    genMode === mode
                      ? 'var(--color-accent-soft)'
                      : 'transparent',
                  color:
                    genMode === mode
                      ? 'var(--color-text)'
                      : 'var(--color-text-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
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
              aria-label={`Generate for ${displayName}`}
              disabled={
                genMode === 'image'
                  ? model === null ||
                    generating ||
                    reference.descriptor.trim().length === 0
                  : describeModel === null ||
                    describing ||
                    activeVersion === null
              }
              onClick={() => {
                if (genMode === 'image') {
                  if (model !== null) {
                    void generateReferenceImage(reference.id, model, resolution)
                  }
                } else if (reference.descriptor.trim().length > 0) {
                  setConfirmingDescribe(true)
                } else {
                  runDescribe()
                }
              }}
            >
              {genMode === 'image'
                ? generating
                  ? 'Generating…'
                  : 'Generate'
                : describing
                  ? 'Describing…'
                  : 'Generate'}
            </button>
            <div style={{ flex: 1, minWidth: '16rem' }}>
              {genMode === 'image' ? (
                <ImageModelPicker
                  selectedId={model?.id ?? null}
                  onSelect={onPickModel}
                  ariaLabel={`Model for ${displayName}`}
                />
              ) : (
                <TextModelPicker
                  selectedId={describeModel?.id ?? null}
                  onSelect={onPickDescribeModel}
                  onlyVision
                  ariaLabel={`Model for ${displayName}`}
                />
              )}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            {genMode === 'image' &&
              model !== null &&
              model.resolutions.length > 0 && (
                <label>
                  <span
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-sm)',
                      marginRight: 'var(--space-2)',
                    }}
                  >
                    Resolution
                  </span>
                  <select
                    aria-label={`Reference ${displayName} resolution`}
                    value={resolution ?? ''}
                    onChange={(e) => {
                      onPickResolution(e.target.value)
                    }}
                  >
                    {model.resolutions.map((r) => (
                      <option key={r} value={r}>
                        {resolutionLabel(r)}
                        {getPerImagePriceUsd(model, r) !== null
                          ? ` — ${formatUsd(getPerImagePriceUsd(model, r) ?? 0)}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {genMode === 'image'
                ? model === null
                  ? 'Pick a model to generate the image from the description; importing is free.'
                  : perImageUsd === null
                    ? 'Cost unknown for this model; importing is free.'
                    : `Cost: ${formatUsd(perImageUsd)}; importing is free.`
                : activeVersion === null
                  ? 'Import an image first — the description is written from it.'
                  : describeModel === null
                    ? 'A text model that can read images writes the description for you — pick one to see the cost. The image is sent only to NanoGPT.'
                    : describeUsd === null
                      ? 'The model reads this image and writes the description; cost unknown for this model.'
                      : `The model reads this image and writes the description — up to ~${formatUsd(describeUsd)} plus the image input.`}
            </span>
          </div>
          {/* The developing strip while the model works (22.9.2) — the
              same wait signal the Images and Animation stages show.
              Labels deliberately avoid the "Reference X description"
              phrasing: aria labels match by substring, and the strip
              must never shadow the textarea. */}
          {generating && (
            <FilmProgress label={`Generating the image for ${displayName}`} />
          )}
          {describing && (
            <FilmProgress
              label={`Writing the description for ${displayName}`}
            />
          )}
        </div>
        {status?.error != null && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}
        {describeStatus?.error != null && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {describeStatus.error}
          </p>
        )}

        {reference.imageVersions.length > 1 && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                display: 'block',
                marginBottom: 'var(--space-1)',
              }}
            >
              Versions (click to make active)
            </span>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              {reference.imageVersions.map((version, vIndex) => (
                <VersionThumb
                  key={version.id}
                  blobPath={version.blobPath}
                  label={`Reference ${displayName} version ${String(vIndex + 1)}`}
                  active={version.id === reference.activeImageVersionId}
                  onSelect={() =>
                    void setActiveReferenceImageVersion(
                      reference.id,
                      version.id,
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        <GenerationHistory
          versions={reference.imageVersions}
          activeVersionId={reference.activeImageVersionId}
          label={`Reference ${displayName}`}
          onRegenerate={(prompt) => {
            if (model !== null) {
              void generateReferenceImage(
                reference.id,
                model,
                resolution,
                prompt,
              )
            }
          }}
          regenerateDisabled={model === null || generating}
          regenerateDisabledHint={
            model === null
              ? 'Pick the image model in this panel first.'
              : 'Another generation is running.'
          }
          regenerateCostUsd={perImageUsd}
          editorHint="This exact text will be sent as the prompt — style and references are not re-added."
        />
      </div>

      {confirmingRemoveImport && activeVersion !== null && (
        <ConfirmDialog
          title="Remove this imported image?"
          message={
            reference.imageVersions.length > 1
              ? 'The previous version becomes the active image again. The import was free — you can import it again any time.'
              : 'The reference returns to having no image. The import was free — you can import it again any time.'
          }
          confirmLabel="Remove image"
          onConfirm={() => {
            setConfirmingRemoveImport(false)
            void removeFreeReferenceImageVersion(reference.id, activeVersion.id)
          }}
          onCancel={() => {
            setConfirmingRemoveImport(false)
          }}
        />
      )}

      {confirmingDescribe && (
        <ConfirmDialog
          title="Replace the description?"
          message="The vision model writes a new description from the reference image, replacing the current one. Scenes that tick this reference will use the new text."
          confirmLabel="Replace description"
          onConfirm={() => {
            setConfirmingDescribe(false)
            runDescribe()
          }}
          onCancel={() => {
            setConfirmingDescribe(false)
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${displayName}?`}
          message="The reference will be removed from every scene that uses it. Any reference images it holds will no longer be used for generation."
          confirmLabel="Delete reference"
          onConfirm={() => {
            setConfirmingDelete(false)
            void removeReference(reference.id)
          }}
          onCancel={() => {
            setConfirmingDelete(false)
          }}
        />
      )}
    </li>
  )
}
