import { useEffect, useRef, useState } from 'react'
import {
  buildIssueUrl,
  FEEDBACK_KINDS,
  GITHUB_REPO_URL,
  type FeedbackKind,
} from '../lib/feedback'

/**
 * The suggestion box (Slice 19; 20.1 restyle): opens like the Settings
 * layer — a fullscreen frosted veil UNDER the navbar, whose ?-button has
 * turned into the X that closes it. The visitor writes a bug report or an
 * idea and "Open on GitHub" carries it to a prefilled new-issue page.
 * Nothing leaves the app by itself — the user sees exactly what they
 * submit, on GitHub, before submitting it.
 */
export function FeedbackOverlay({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const overlayRef = useRef<HTMLDivElement | null>(null)

  // Same manners as the Settings layer: focus moves in, Escape closes.
  useEffect(() => {
    overlayRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const canSend = summary.trim().length > 0
  const issueUrl = canSend ? buildIssueUrl({ kind, summary, details }) : null

  const fieldLabel = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-muted)',
    display: 'block',
    marginBottom: 'var(--space-1)',
  } as const

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
      tabIndex={-1}
      className="settings-overlay"
    >
      <div
        style={{
          maxWidth: '36rem',
          width: '100%',
          margin: '0 auto',
          padding: 'var(--space-6) var(--space-4) var(--space-8)',
        }}
      >
        <div
          className="card"
          style={{
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
                fontWeight: 700,
              }}
            >
              From the audience
            </div>
            <h3 style={{ margin: 'var(--space-1) 0 0' }}>Make Kairo better</h3>
            <p
              style={{
                margin: 'var(--space-2) 0 0',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Found a bug, or wishing for something? Write it up here and it
              opens as a prefilled GitHub issue — you see exactly what gets
              posted before you post it.
            </p>
          </div>

          <div>
            <label style={fieldLabel} htmlFor="feedback-kind">
              What kind of note is this?
            </label>
            <select
              id="feedback-kind"
              aria-label="Feedback type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as FeedbackKind)
              }}
            >
              {FEEDBACK_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabel} htmlFor="feedback-summary">
              One line that says it all
            </label>
            <input
              id="feedback-summary"
              aria-label="Feedback summary"
              value={summary}
              placeholder={
                kind === 'bug'
                  ? 'e.g. The export button stays disabled after…'
                  : 'e.g. It would be great if scenes could…'
              }
              onChange={(e) => {
                setSummary(e.target.value)
              }}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={fieldLabel} htmlFor="feedback-details">
              The full story (optional)
            </label>
            <textarea
              id="feedback-details"
              aria-label="Feedback details"
              value={details}
              rows={5}
              placeholder="What happened, what you expected, steps to reproduce — or the idea in as much detail as you like."
              onChange={(e) => {
                setDetails(e.target.value)
              }}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            {issueUrl !== null ? (
              <a
                href={issueUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Open on GitHub"
                style={{
                  // Dressed as the primary button (button.primary styles
                  // don't reach anchors).
                  textDecoration: 'none',
                  display: 'inline-block',
                  background: 'var(--color-cta-bg)',
                  color: 'var(--color-cta-text)',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-pill)',
                  padding: 'var(--space-2) var(--space-4)',
                  fontWeight: 600,
                }}
              >
                Open on GitHub ↗
              </a>
            ) : (
              <button type="button" className="primary" disabled>
                Open on GitHub ↗
              </button>
            )}
            <button type="button" onClick={onClose}>
              Never mind
            </button>
            <a
              href={`${GITHUB_REPO_URL}/issues`}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                marginLeft: 'auto',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              browse existing issues
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
