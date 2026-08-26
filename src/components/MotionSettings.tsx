import { useSyncExternalStore } from 'react'
import { useT } from '../i18n'
import { useSettingsStore, type MotionMode } from '../state/settings'

/** Live view of the OS-level reduced-motion preference. */
function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      try {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        query.addEventListener('change', onChange)
        return () => {
          query.removeEventListener('change', onChange)
        }
      } catch {
        return () => undefined
      }
    },
    () => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      } catch {
        return false
      }
    },
  )
}

/**
 * Motion preference (ADR-013 follow-up): Kairo honors the OS
 * "reduce motion" setting by default, which silently hides EVERY animation
 * — and nothing in the UI said why. This control makes the state visible
 * and lets the user override in either direction.
 */
export function MotionSettings() {
  const t = useT()
  const motionMode = useSettingsStore((s) => s.motionMode)
  const setMotionMode = useSettingsStore((s) => s.setMotionMode)
  const systemReduced = useSystemReducedMotion()

  return (
    <section
      className="card"
      style={{ padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}
    >
      <h2 style={{ marginTop: 0, fontSize: 'var(--text-lg)' }}>
        {t('Motion')}
      </h2>
      <p style={{ color: 'var(--color-text-muted)' }}>
        {t('Stage transitions, progress strips and the other animations.')}
      </p>
      <label>
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            marginRight: 'var(--space-2)',
          }}
        >
          {t('Animations')}
        </span>
        <select
          aria-label="Motion preference"
          value={motionMode}
          onChange={(e) => {
            setMotionMode(e.target.value as MotionMode)
          }}
        >
          <option value="system">{t('Follow system setting')}</option>
          <option value="on">{t('Always on')}</option>
          <option value="off">{t('Off')}</option>
        </select>
      </label>
      {motionMode === 'system' && systemReduced && (
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            marginBottom: 0,
          }}
        >
          {t(
            'Your system asks apps to reduce motion, so Kairo is currently showing none of its animations. Choose “Always on” to see them anyway.',
          )}
        </p>
      )}
    </section>
  )
}
