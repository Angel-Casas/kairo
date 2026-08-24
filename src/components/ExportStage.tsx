import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FilmProgress } from './FilmProgress'
import {
  buildClipsZip,
  downloadBlob,
  exportFileStem,
  planClipsExport,
} from '../lib/exporter'
import { StitchError, stitchClips } from '../lib/stitcher'
import { exportProject } from '../persistence/projectFile'
import { useProjectStore } from '../state/project'
import { getRepository } from '../state/repo'
import { formatUsd } from '../lib/format'
import { Perforation } from './Reel'
import { useBlobUrl } from './useBlobUrl'
import { useFormatSpec } from './useFormatSpec'
import { clipCarriesOwnAudio } from '../domain/types'
import type { CostLogEntry, GenerationKind, Scene } from '../domain/types'

type Busy = 'zip' | 'backup' | 'stitch-loading' | 'stitch-running' | null

/**
 * Credits are drawn from the project's real production history: every
 * distinct model that actually charged for work, grouped by department.
 * Exported for tests.
 */
export function creditsByKind(
  costLog: CostLogEntry[],
): Partial<Record<GenerationKind, string[]>> {
  const out: Partial<Record<GenerationKind, string[]>> = {}
  for (const entry of costLog) {
    const list = out[entry.kind] ?? []
    if (!list.includes(entry.model)) list.push(entry.model)
    out[entry.kind] = list
  }
  return out
}

/** A scene's screening slot: its active clip plus the narration to pair. */
interface PremiereItem {
  scene: Scene
  n: number
  videoBlobPath: string
  videoMime: string | undefined
  narrationBlobPath: string | null
  narrationMime: string | undefined
}

function premiereProgram(scenes: Scene[]): PremiereItem[] {
  const items: PremiereItem[] = []
  for (const [i, scene] of scenes.entries()) {
    const clip = scene.videoVersions.find(
      (v) => v.id === scene.activeVideoVersionId,
    )
    if (clip === undefined) continue
    const narration = clipCarriesOwnAudio(clip)
      ? undefined
      : scene.audioVersions.find((v) => v.id === scene.activeAudioVersionId)
    items.push({
      scene,
      n: i + 1,
      videoBlobPath: clip.blobPath,
      videoMime: clip.mimeType,
      narrationBlobPath: narration?.blobPath ?? null,
      narrationMime: narration?.mimeType,
    })
  }
  return items
}

/**
 * The premiere player (Slice 17): the finished takes, screened in order
 * with their narration — watch the Short before you take it home.
 */
function PremierePlayer({ items }: { items: PremiereItem[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [sceneFraction, setSceneFraction] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const formatSpec = useFormatSpec()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const narrationRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)

  // Fullscreen rides the browser's own state (Escape exits natively), so
  // the UI just mirrors whether OUR frame is the fullscreen element.
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === frameRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
    }
  }, [])

  const item = items[Math.min(index, items.length - 1)]
  const videoUrl = useBlobUrl(item?.videoBlobPath ?? null, item?.videoMime)
  const narrationUrl = useBlobUrl(
    item?.narrationBlobPath ?? null,
    item?.narrationMime,
  )

  // A fresh program (clips changed) restarts the screening.
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
    setFinished(false)
    setSceneFraction(0)
  }, [items.length])

  if (item === undefined) return null

  const play = () => {
    setFinished(false)
    setPlaying(true)
    void videoRef.current?.play().catch(() => undefined)
    if (narrationUrl !== null && narrationRef.current !== null) {
      narrationRef.current.currentTime = videoRef.current?.currentTime ?? 0
      void narrationRef.current.play().catch(() => undefined)
    }
  }
  const pause = () => {
    setPlaying(false)
    videoRef.current?.pause()
    narrationRef.current?.pause()
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => undefined)
    } else {
      void frameRef.current?.requestFullscreen().catch(() => undefined)
    }
  }

  const overallProgress =
    items.length === 0
      ? 0
      : (Math.min(index, items.length - 1) + sceneFraction) / items.length

  const caption = finished ? (
    <span>
      That was{' '}
      <strong style={{ color: fullscreen ? '#ffffff' : 'var(--color-text)' }}>
        the whole reel
      </strong>{' '}
      {fullscreen ? '— encore?' : '— encore, or take it home below.'}
    </span>
  ) : (
    <span>
      Scene {item.n} of {items.length}
      {item.scene.textExcerpt.trim().length > 0 && (
        <span style={{ fontStyle: 'italic' }}>
          {' '}
          — &ldquo;{item.scene.textExcerpt.trim()}&rdquo;
        </span>
      )}
    </span>
  )

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-sm)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          alignSelf: 'flex-start',
        }}
      >
        Tonight&rsquo;s screening
      </div>
      <div
        ref={frameRef}
        className="premiere-frame"
        style={{ position: 'relative' }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated clips; the scene excerpt below is the caption */}
        <video
          key={item.scene.id}
          className="develop-in"
          ref={videoRef}
          src={videoUrl ?? undefined}
          aria-label={`Premiere — scene ${String(item.n)}`}
          playsInline
          onTimeUpdate={(e) => {
            const d = e.currentTarget.duration
            if (Number.isFinite(d) && d > 0) {
              setSceneFraction(e.currentTarget.currentTime / d)
            }
          }}
          onEnded={() => {
            narrationRef.current?.pause()
            setSceneFraction(0)
            if (index < items.length - 1) {
              setIndex(index + 1)
              // Let the next clip mount, then continue the screening.
              setTimeout(() => {
                void videoRef.current?.play().catch(() => undefined)
                if (narrationRef.current !== null) {
                  narrationRef.current.currentTime = 0
                  void narrationRef.current.play().catch(() => undefined)
                }
              }, 60)
            } else {
              setPlaying(false)
              setFinished(true)
            }
          }}
          style={{
            // Portrait keeps a slim screen; landscape formats widen so the
            // premiere is not a postage stamp (Slice 18).
            width: fullscreen
              ? '100%'
              : formatSpec.ratio > 1.5
                ? '24rem'
                : formatSpec.ratio >= 1
                  ? '18rem'
                  : '15rem',
            height: fullscreen ? '100%' : undefined,
            aspectRatio: fullscreen ? undefined : formatSpec.cssAspect,
            objectFit: fullscreen ? 'contain' : undefined,
            borderRadius: fullscreen ? 0 : 'var(--radius)',
            background: fullscreen ? '#000000' : 'var(--color-surface-2)',
            display: 'block',
          }}
        />
        {narrationUrl !== null && (
          <audio
            ref={narrationRef}
            src={narrationUrl}
            aria-label={`Scene ${String(item.n)} narration (plays with the premiere)`}
          />
        )}
        <button
          type="button"
          aria-label={playing ? 'Pause the premiere' : 'Play the premiere'}
          onClick={playing ? pause : play}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            background: playing ? 'transparent' : 'rgba(0, 0, 0, 0.35)',
            border: 'none',
            borderRadius: fullscreen ? 0 : 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          {!playing && (
            <span
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(0, 0, 0, 0.55)',
                border: '1.5px solid rgba(255, 255, 255, 0.6)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {finished ? (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12 a7 7 0 1 1 2 5 M5 17 v-5 h5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8.5 5.8 L18.5 12 L8.5 18.2 Z" fill="currentColor" />
                </svg>
              )}
            </span>
          )}
        </button>
        {/* The balcony seat: screen the premiere edge to edge. Sits above
            the play overlay; Escape (or the button again) comes back. */}
        <button
          type="button"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Watch fullscreen'}
          onClick={toggleFullscreen}
          style={{
            position: 'absolute',
            right: fullscreen ? 'var(--space-4)' : 'var(--space-2)',
            top: fullscreen ? 'var(--space-4)' : 'var(--space-2)',
            width: '36px',
            height: '36px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.55)',
            border: '1.5px solid rgba(255, 255, 255, 0.6)',
            borderRadius: 'var(--radius-pill)',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          {fullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 3 v6 h-6 M15 3 v6 h6 M9 21 v-6 h-6 M15 21 v-6 h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 9 V3 h6 M21 9 V3 h-6 M3 15 v6 h6 M21 15 v6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        {/* In fullscreen the progress strip and caption move into the
            frame, resting at the bottom like a cinema subtitle band. */}
        {fullscreen && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ width: 'min(24rem, 70vw)' }}>
              <FilmProgress
                value={overallProgress}
                label="Premiere progress (fullscreen)"
              />
            </div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'rgba(255, 255, 255, 0.85)',
                textAlign: 'center',
                maxWidth: '32rem',
                textShadow: '0 1px 6px rgba(0, 0, 0, 0.8)',
              }}
            >
              {caption}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          width:
            formatSpec.ratio > 1.5
              ? '24rem'
              : formatSpec.ratio >= 1
                ? '18rem'
                : '15rem',
          maxWidth: '100%',
        }}
      >
        <FilmProgress value={overallProgress} label="Premiere progress" />
      </div>
      <div
        aria-label="Now showing"
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          maxWidth: '17rem',
        }}
      >
        {caption}
      </div>
    </div>
  )
}

const KIND_DEPARTMENTS: [GenerationKind, string][] = [
  ['text', 'Written with'],
  ['audio', 'Narrated by'],
  ['image', 'Cinematography'],
  ['video', 'Motion by'],
]

export function ExportStage() {
  const project = useProjectStore((s) => s.project)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  if (project === null) return null
  const plan = planClipsExport(project)
  const stem = exportFileStem(project.title)

  const downloadClipsZip = async () => {
    setBusy('zip')
    setError(null)
    try {
      const repo = await getRepository()
      const { zip } = await buildClipsZip(project, repo.blobs)
      downloadBlob(zip, `${stem}.zip`)
    } catch {
      setError('The clips zip could not be built. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const downloadBackup = async () => {
    setBusy('backup')
    setError(null)
    try {
      const repo = await getRepository()
      const backup = await exportProject(project, repo.blobs)
      downloadBlob(backup, `${stem}.kairo`)
    } catch {
      setError('The project backup could not be built. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const downloadStitchedDraft = async () => {
    setBusy('stitch-loading')
    setError(null)
    try {
      const repo = await getRepository()
      const clips: Blob[] = []
      for (const { scene } of plan.included) {
        const active = scene.videoVersions.find(
          (v) => v.id === scene.activeVideoVersionId,
        )
        if (active === undefined) continue
        const blob = await repo.blobs.get(active.blobPath)
        if (blob !== null) clips.push(blob)
      }
      const draft = await stitchClips(clips, (progress) => {
        setBusy(
          progress.phase === 'loading-engine'
            ? 'stitch-loading'
            : 'stitch-running',
        )
      })
      downloadBlob(draft, `${stem}-draft.mp4`)
    } catch (stitchError) {
      setError(
        stitchError instanceof StitchError
          ? stitchError.message
          : 'Stitching failed unexpectedly.',
      )
    } finally {
      setBusy(null)
    }
  }

  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
  const clipCount = plan.included.length
  const totalScenes = project.scenes.length
  const complete = clipCount === totalScenes && totalScenes > 0
  const program = premiereProgram(scenes)
  const spentUsd = project.costLog.reduce(
    (sum, e) => sum + (e.actualUsd ?? e.estimatedUsd ?? 0),
    0,
  )
  const credits = creditsByKind(project.costLog)
  const creditRows = KIND_DEPARTMENTS.filter(
    ([kind]) => (credits[kind] ?? []).length > 0,
  )

  const panelTitle: CSSProperties = {
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
  }

  const creditsContent = (
    <>
      {creditRows.map(([kind, label]) => (
        <div key={kind} style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: '2px',
            }}
          >
            {label}
          </div>
          {(credits[kind] ?? []).map((model) => (
            <div key={model} style={{ fontWeight: 600 }}>
              {model}
            </div>
          ))}
        </div>
      ))}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '2px',
          }}
        >
          Directed and produced by
        </div>
        <div style={{ fontWeight: 600 }}>you</div>
      </div>
      <div
        style={{
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
        }}
      >
        A Kairo production — made in your browser, on your key.
      </div>
    </>
  )

  return (
    <section>
      {/* The title card: this is a premiere, not a file manager. */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4) var(--space-6)',
          marginBottom: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <Perforation />
        <div style={{ padding: 'var(--space-4) 0' }}>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              fontWeight: 700,
            }}
          >
            Premiere night
          </div>
          <h3
            style={{
              margin: 'var(--space-2) 0',
              fontSize: 'var(--text-xl)',
              letterSpacing: '-0.01em',
            }}
          >
            {project.title}
          </h3>
          <p
            aria-label="Export readiness"
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
            }}
          >
            {complete
              ? `That's a wrap — ${String(clipCount)} of ${String(totalScenes)} ${totalScenes === 1 ? 'scene has' : 'scenes have'} a finished clip. `
              : `Nearly there — ${String(clipCount)} of ${String(totalScenes)} ${clipCount === 1 ? 'scene has' : 'scenes have'} a finished clip. `}
            {plan.missingSceneNumbers.length > 0 &&
              `Missing: scene${plan.missingSceneNumbers.length === 1 ? '' : 's'} ${plan.missingSceneNumbers.join(', ')} — you can premiere what's ready and add the rest later. `}
            {String(totalScenes)} {totalScenes === 1 ? 'scene' : 'scenes'} ·{' '}
            {project.costLog.length} generations · made for{' '}
            {formatUsd(spentUsd)}
          </p>
        </div>
        <Perforation />
      </div>

      {/* The screening room: premiere player beside the credits roll. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(19rem, 100%), 1fr))',
          gap: 'var(--space-4)',
          alignItems: 'stretch',
          marginBottom: 'var(--space-4)',
        }}
      >
        {program.length > 0 ? (
          <PremierePlayer items={program} />
        ) : (
          <div
            className="card"
            style={{
              padding: 'var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            The screen is still dark — animate at least one scene and the
            premiere begins here.
          </div>
        )}

        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            minHeight: 0,
          }}
        >
          <div style={panelTitle}>The credits</div>
          {creditRows.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
              The cast assembles as you generate — every model that works on
              this project earns its line here.
            </p>
          ) : (
            <div className="credits-roll" aria-label="Production credits">
              <div className="credits-track">
                <div className="credits-block">{creditsContent}</div>
                <div className="credits-block" aria-hidden="true">
                  {creditsContent}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The final cut, frame by frame. */}
      {scenes.some((s) => s.activeImageVersionId !== null) && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3) var(--space-4) var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div
            style={{
              ...panelTitle,
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 var(--space-1) var(--space-2)',
            }}
          >
            <span>The final cut</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>
              frame by frame
            </span>
          </div>
          <Perforation />
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              overflowX: 'auto',
              padding: 'var(--space-2) var(--space-1)',
            }}
          >
            {scenes.map((scene, i) => (
              <RecapFrame key={scene.id} scene={scene} n={i + 1} />
            ))}
          </div>
          <Perforation />
        </div>
      )}

      {/* Take it home. */}
      <div style={{ ...panelTitle, margin: '0 0 var(--space-3)' }}>
        Take it home
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(20rem, 100%), 1fr))',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Take it to the edit</h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            A zip with your clips numbered in scene order plus the script as a
            text file — bring them into any editor for the final polish.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy !== null || clipCount === 0}
            onClick={() => void downloadClipsZip()}
          >
            {busy === 'zip' ? 'Building zip…' : `Download clips (.zip)`}
          </button>
          {busy === 'zip' && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <FilmProgress label="Clips zip building" />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>The one-file premiere</h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            All your clips stitched back to back into one MP4 — a draft you can
            watch anywhere or publish as-is. The video engine (~31 MB) downloads
            the first time; if stitching fails, the clips zip always works.
          </p>
          <button
            type="button"
            disabled={busy !== null || clipCount === 0}
            onClick={() => void downloadStitchedDraft()}
          >
            {busy === 'stitch-loading'
              ? 'Downloading video engine…'
              : busy === 'stitch-running'
                ? 'Stitching…'
                : 'Create stitched draft (.mp4)'}
          </button>
          {(busy === 'stitch-loading' || busy === 'stitch-running') && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <FilmProgress label="Stitched draft building" />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Keep the negatives</h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            The whole production — script, scenes, every take of every image and
            clip — as one .kairo file. Bring it back with &ldquo;Import
            project&rdquo; on any device and pick up where you left off.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void downloadBackup()}
          >
            {busy === 'backup'
              ? 'Building backup…'
              : 'Download project backup (.kairo)'}
          </button>
          {busy === 'backup' && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <FilmProgress label="Project backup building" />
            </div>
          )}
        </div>
      </div>

      {error !== null && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </section>
  )
}

/** One frame of the recap strip: the scene's final image, or its absence. */
function RecapFrame({ scene, n }: { scene: Scene; n: number }) {
  const formatSpec = useFormatSpec()
  const active =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const url = useBlobUrl(active?.blobPath ?? null, active?.mimeType)
  const hasClip = scene.videoVersions.some(
    (v) => v.id === scene.activeVideoVersionId,
  )
  return (
    <div
      aria-label={`Final cut frame ${String(n)}`}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: formatSpec.ratio > 1 ? '8rem' : '4.5rem',
        aspectRatio: formatSpec.cssAspect,
        borderRadius: '8px',
        overflow: 'hidden',
        border: hasClip
          ? '1px solid var(--color-border)'
          : '1px dashed var(--color-border)',
        background: 'var(--color-surface)',
        opacity: hasClip ? 1 : 0.55,
      }}
    >
      {url !== null && (
        <img
          src={url}
          alt={`Scene ${String(n)} final frame`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
      <span
        style={{
          position: 'absolute',
          left: '4px',
          bottom: '2px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#ffffff',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
        }}
      >
        {n}
      </span>
    </div>
  )
}
