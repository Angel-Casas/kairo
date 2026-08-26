import { useState } from 'react'
import type { AssetVersion } from '../domain/types'
import { useT } from '../i18n'
import { formatUsd } from '../lib/format'

/**
 * Generation history (Slice 11): every stored version with the exact prompt
 * that produced it — copyable, and (for images) editable for a verbatim
 * regeneration. Iteration becomes surgical instead of from-scratch.
 */
export function GenerationHistory({
  versions,
  activeVersionId,
  label,
  onRegenerate,
  regenerateDisabled = false,
  regenerateCostUsd = null,
  regenerateDisabledHint,
  regenerateCostText,
  editorHint = 'This exact text will be sent as the prompt.',
}: {
  versions: AssetVersion[]
  activeVersionId: string | null
  /** Context label for aria labels, e.g. "Scene 1 image". */
  label: string
  /** When set, image versions offer "Edit & regenerate" with this callback. */
  onRegenerate?: (prompt: string) => void
  regenerateDisabled?: boolean
  regenerateCostUsd?: number | null
  /** Shown next to a disabled generate button, e.g. "Pick a model first." */
  regenerateDisabledHint?: string
  /**
   * Overrides the cost label when set — for kinds whose price is only known
   * at submission (video), where a confirmation dialog follows.
   */
  regenerateCostText?: string
  /** Explainer above the editor; defaults to the generic verbatim note. */
  editorHint?: string
}) {
  const t = useT()
  const [copiedVersionId, setCopiedVersionId] = useState<string | null>(null)
  const [tweakVersionId, setTweakVersionId] = useState<string | null>(null)
  const [tweakText, setTweakText] = useState('')

  if (versions.length === 0) return null

  const newestFirst = versions
    .map((version, index) => ({ version, number: index + 1 }))
    .reverse()

  const copyPrompt = async (version: AssetVersion) => {
    try {
      await navigator.clipboard.writeText(version.prompt)
      setCopiedVersionId(version.id)
      setTimeout(() => {
        setCopiedVersionId((current) =>
          current === version.id ? null : current,
        )
      }, 2000)
    } catch {
      // Clipboard access denied — the prompt is still visible to select.
    }
  }

  return (
    <details style={{ marginTop: 'var(--space-3)' }}>
      <summary
        aria-label={`${label} history`}
        style={{
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        {t('History')} ({versions.length})
      </summary>
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 'var(--space-2) 0 0',
        }}
      >
        {newestFirst.map(({ version, number }) => (
          <li
            key={version.id}
            aria-label={`${label} version ${String(number)} details`}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
                fontSize: 'var(--text-sm)',
              }}
            >
              <strong>{t('Version {n}', { n: number })}</strong>
              {version.id === activeVersionId && (
                <span style={{ color: 'var(--color-accent)' }}>
                  {t('active')}
                </span>
              )}
              <span style={{ color: 'var(--color-text-muted)' }}>
                {version.model === 'imported'
                  ? t('imported file')
                  : version.model}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {version.model === 'imported'
                  ? t('free')
                  : version.costUsd !== null
                    ? formatUsd(version.costUsd)
                    : t('cost unknown')}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {new Date(version.createdAt).toLocaleString()}
              </span>
            </div>

            {version.prompt.length === 0 ? (
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                  margin: 'var(--space-1) 0 0',
                }}
              >
                {t('No prompt was stored for this version.')}
              </p>
            ) : (
              <>
                <pre
                  aria-label={`${label} version ${String(number)} prompt`}
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    fontSize: 'var(--text-sm)',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: 'var(--space-2)',
                    margin: 'var(--space-2) 0',
                  }}
                >
                  {version.prompt}
                </pre>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Copy ${label} version ${String(number)} prompt`}
                    onClick={() => void copyPrompt(version)}
                  >
                    {copiedVersionId === version.id
                      ? t('Copied')
                      : t('Copy prompt')}
                  </button>
                  {onRegenerate !== undefined &&
                    tweakVersionId !== version.id && (
                      <button
                        type="button"
                        aria-label={`Edit and regenerate from ${label} version ${String(number)}`}
                        onClick={() => {
                          setTweakVersionId(version.id)
                          setTweakText(version.prompt)
                        }}
                      >
                        {t('Edit & regenerate')}
                      </button>
                    )}
                </div>
                {onRegenerate !== undefined &&
                  tweakVersionId === version.id && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <label style={{ display: 'block' }}>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--color-text-muted)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {editorHint}
                        </span>
                        <textarea
                          value={tweakText}
                          onChange={(e) => {
                            setTweakText(e.target.value)
                          }}
                          aria-label={`${label} version ${String(number)} edited prompt`}
                          rows={4}
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
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          flexWrap: 'wrap',
                          marginTop: 'var(--space-1)',
                        }}
                      >
                        <button
                          type="button"
                          disabled={
                            regenerateDisabled || tweakText.trim().length === 0
                          }
                          onClick={() => {
                            onRegenerate(tweakText)
                            setTweakVersionId(null)
                          }}
                        >
                          {t('Generate with this prompt')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTweakVersionId(null)
                          }}
                        >
                          {t('Cancel')}
                        </button>
                        <span
                          style={{
                            color: 'var(--color-text-muted)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {regenerateDisabled
                            ? (regenerateDisabledHint ??
                              t('Generation is unavailable right now.'))
                            : (regenerateCostText ??
                              (regenerateCostUsd !== null
                                ? t('Cost: {usd}', {
                                    usd: formatUsd(regenerateCostUsd),
                                  })
                                : t('Cost unknown for this model.')))}
                        </span>
                      </div>
                    </div>
                  )}
              </>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
