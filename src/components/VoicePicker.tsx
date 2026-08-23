import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TtsModel } from '../api/nanogpt'
import { ttsCostUsd, VOICE_PREVIEW_TEXT, voiceLabel } from '../domain/ttsModels'
import { formatUsd } from '../lib/format'
import { FilmProgress } from './FilmProgress'
import { useProjectStore } from '../state/project'
import { getRepository } from '../state/repo'

/**
 * The voice menu (Slice 15.9, modeled on NanoGPT's own voice dropdown at
 * Angel's request): every voice gets a ▶ preview button so users can HEAR
 * a voice before spending on a full narration. NanoGPT exposes no free
 * sample files, so a preview narrates one short fixed sentence through
 * the real endpoint — the exact fraction-of-a-cent price is printed in
 * the menu footer — and is then cached in OPFS, replaying free forever.
 *
 * 15.9.1 (Angel's feedback): cached previews are detected up front and
 * marked on their ▶ button, decoded object URLs are kept in memory for
 * instant replay, "Load all" fetches every missing preview at a stated
 * exact total, and playback failures surface as messages instead of
 * silence.
 */

/** Session-lived object URLs of decoded previews, keyed model|voice. */
const previewUrls = new Map<string, string>()

export function VoicePicker({
  model,
  voice,
  onSelect,
}: {
  model: TtsModel
  voice: string
  onSelect: (voiceId: string) => void
}) {
  const previewVoice = useProjectStore((s) => s.previewVoice)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingAll, setLoadingAll] = useState<{
    done: number
    total: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopPreview = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(null)
  }, [])

  // Escape closes; leaving the menu stops any playing preview.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      stopPreview()
    }
  }, [open, stopPreview])

  // On open, learn which previews are already cached (OPFS + this session).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void getRepository()
      .then((repo) =>
        repo.blobs.list(`voice-previews/${encodeURIComponent(model.id)}`),
      )
      .then((paths) => {
        if (cancelled) return
        const fromDisk = paths
          .map((p) => decodeURIComponent(p.split('/').pop() ?? ''))
          .filter((v) => v.length > 0)
        const fromSession = model.voices.filter((v) =>
          previewUrls.has(`${model.id}|${v}`),
        )
        setCached(new Set([...fromDisk, ...fromSession]))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, model])

  /** Resolve a voice's preview to an object URL (cache-first). */
  const previewUrl = async (voiceId: string): Promise<string | null> => {
    const key = `${model.id}|${voiceId}`
    const known = previewUrls.get(key)
    if (known !== undefined) return known
    const result = await previewVoice(model, voiceId)
    if (!result.ok) {
      // The store hands back the REAL reason (the API's own error, or an
      // honest "billed but unplayable") — show it, not a generic line.
      setError(result.error)
      return null
    }
    const url = URL.createObjectURL(result.blob)
    previewUrls.set(key, url)
    setCached((prev) => new Set(prev).add(voiceId))
    return url
  }

  const play = async (voiceId: string) => {
    stopPreview()
    setError(null)
    setLoading(voiceId)
    const url = await previewUrl(voiceId)
    setLoading(null)
    if (url === null) return // previewUrl already surfaced the reason
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => {
      setPlaying(null)
    }
    audio.onerror = () => {
      setPlaying(null)
      setError('This preview could not be decoded — try another voice.')
    }
    setPlaying(voiceId)
    try {
      await audio.play()
    } catch {
      setPlaying(null)
      setError('Playback was blocked by the browser — press ▶ again.')
    }
  }

  const loadAll = async (voices: string[]) => {
    setError(null)
    setLoadingAll({ done: 0, total: voices.length })
    let failed = 0
    for (const [i, v] of voices.entries()) {
      const url = await previewUrl(v)
      if (url === null) failed += 1
      setLoadingAll({ done: i + 1, total: voices.length })
    }
    setLoadingAll(null)
    if (failed > 0) {
      setError(
        `${String(failed)} of ${String(voices.length)} previews returned no playable audio.`,
      )
    }
  }

  const query = filter.trim().toLowerCase()
  const shown = model.voices.filter(
    (v) =>
      query.length === 0 ||
      v.toLowerCase().includes(query) ||
      voiceLabel(v).toLowerCase().includes(query),
  )
  const previewUsd = ttsCostUsd(model, VOICE_PREVIEW_TEXT)
  const uncached = model.voices.filter((v) => !cached.has(v))
  const loadAllUsd = previewUsd === null ? null : previewUsd * uncached.length

  return (
    <>
      <button
        type="button"
        aria-label="Voice"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          width: '100%',
          textAlign: 'left',
          fontWeight: 400,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: voice.length === 0 ? 'var(--color-text-muted)' : undefined,
          }}
        >
          {voice.length > 0
            ? voiceLabel(voice)
            : `Choose a voice… (${String(model.voices.length)} available)`}
        </span>
        <svg
          width="9"
          height="6"
          viewBox="0 0 9 6"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.8 }}
        >
          <path
            d="M1 1.2 L4.5 4.8 L8 1.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            className="motion-veil"
            onClick={() => {
              setOpen(false)
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 12,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: 'var(--space-6) var(--space-4)',
              cursor: 'zoom-out',
            }}
          >
            <div
              className="motion-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Voice menu"
              onClick={(e) => {
                e.stopPropagation()
              }}
              style={{
                width: 'min(30rem, 96vw)',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                overflow: 'hidden',
                cursor: 'default',
              }}
            >
              {model.voices.length > 8 && (
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <input
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value)
                    }}
                    placeholder="Search voices…"
                    aria-label="Filter voices"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              )}
              <div
                role="listbox"
                aria-label="Voice options"
                style={{
                  overflowY: 'auto',
                  minHeight: '10rem',
                  maxHeight: '55vh',
                  padding: 'var(--space-2) var(--space-3)',
                }}
              >
                {shown.length === 0 && (
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      padding: 'var(--space-3)',
                    }}
                  >
                    No voices match.
                  </p>
                )}
                {shown.map((v) => {
                  const active = v === voice
                  const busy = loading === v
                  const isPlaying = playing === v
                  const isCached = cached.has(v)
                  return (
                    <div
                      key={v}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onSelect(v)
                          setOpen(false)
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          background: active
                            ? 'var(--color-accent-soft)'
                            : 'transparent',
                          border: active
                            ? '1px solid var(--color-accent)'
                            : '1px solid transparent',
                          boxShadow: 'none',
                          padding: 'var(--space-2) var(--space-3)',
                          fontWeight: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {voiceLabel(v)}
                      </button>
                      <button
                        type="button"
                        aria-label={`Preview voice ${voiceLabel(v)}`}
                        aria-pressed={isPlaying}
                        disabled={busy || loadingAll !== null}
                        title={
                          isCached
                            ? 'Preview cached — plays instantly, free.'
                            : previewUsd === null
                              ? 'Narrates a short sample through the model.'
                              : `First listen narrates a short sample (${formatUsd(previewUsd)}); cached after.`
                        }
                        onClick={() => {
                          if (isPlaying) {
                            stopPreview()
                          } else {
                            void play(v)
                          }
                        }}
                        style={{
                          flexShrink: 0,
                          width: '2.2rem',
                          boxShadow: 'none',
                          border: isCached
                            ? '1px solid var(--color-accent)'
                            : '1px solid var(--color-border)',
                          background: isPlaying
                            ? 'var(--color-accent-soft)'
                            : 'transparent',
                          color: isCached
                            ? 'var(--color-accent)'
                            : 'var(--color-text)',
                          padding: 'var(--space-1) 0',
                          textAlign: 'center',
                        }}
                      >
                        {busy ? '…' : isPlaying ? '■' : '▶'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <span
                  role={error === null ? undefined : 'alert'}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  {error ??
                    (loadingAll !== null
                      ? `Loading previews… ${String(loadingAll.done)}/${String(loadingAll.total)}`
                      : previewUsd === null
                        ? '▶ narrates a short sample through the model.'
                        : `▶ narrates a short sample once (${formatUsd(previewUsd)}), then replays free from cache.`)}
                  {loadingAll !== null && (
                    <FilmProgress
                      value={
                        loadingAll.total > 0
                          ? loadingAll.done / loadingAll.total
                          : null
                      }
                      label="Voice previews loading"
                    />
                  )}
                </span>
                <span
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    flexShrink: 0,
                  }}
                >
                  {uncached.length > 0 &&
                    loadAllUsd !== null &&
                    loadingAll === null && (
                      <button
                        type="button"
                        aria-label="Load all previews"
                        title={`Narrates the sample once for each of the ${String(uncached.length)} missing voices — exact total ${formatUsd(loadAllUsd)}.`}
                        onClick={() => void loadAll(uncached)}
                        style={{
                          fontSize: 'var(--text-sm)',
                          padding: 'var(--space-1) var(--space-3)',
                        }}
                      >
                        Load all ({formatUsd(loadAllUsd)})
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                    }}
                    style={{
                      fontSize: 'var(--text-sm)',
                      padding: 'var(--space-1) var(--space-3)',
                    }}
                  >
                    Close
                  </button>
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
