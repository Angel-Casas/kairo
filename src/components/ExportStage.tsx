import { useState } from 'react'
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

type Busy = 'zip' | 'backup' | 'stitch-loading' | 'stitch-running' | null

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

  const clipCount = plan.included.length
  const totalScenes = project.scenes.length

  return (
    <section>
      <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Export</h3>

      <p
        aria-label="Export readiness"
        className="card"
        style={{
          padding: 'var(--space-3) var(--space-4)',
          margin: '0 0 var(--space-4)',
        }}
      >
        {clipCount} of {totalScenes} {totalScenes === 1 ? 'scene' : 'scenes'}{' '}
        {clipCount === 1 ? 'has' : 'have'} a finished clip.
        {plan.missingSceneNumbers.length > 0 &&
          ` Missing: scene${plan.missingSceneNumbers.length === 1 ? '' : 's'} ${plan.missingSceneNumbers.join(', ')} — you can export now and add them later.`}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
      >
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
          }}
        >
          <h4 style={{ marginTop: 0 }}>Clips for your video editor</h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            A zip with the clips numbered in scene order plus the script as a
            text file — import them into any editor to polish and publish.
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

        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
          }}
        >
          <h4 style={{ marginTop: 0 }}>Stitched draft</h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            One MP4 with all clips back to back — a quick preview or
            quick-publish draft. The video engine (~31 MB) downloads the first
            time you use this. Works best when all clips come from the same
            model and settings; if stitching fails, use the clips zip.
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

        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
          }}
        >
          <h4 style={{ marginTop: 0 }}>Project backup</h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            The whole project — script, scenes, every image and clip version —
            as one .kairo file. This file is not meant to be opened directly:
            bring it back into Kairo with the "Import project (.kairo)" button
            on the project list, on any device. (Under the hood it is a standard
            zip archive — rename it to .zip if you ever want to peek inside.)
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
