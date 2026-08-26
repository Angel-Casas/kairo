import { useEffect, useRef, useState } from 'react'
import { useI18nStore, useT } from '../i18n'
import { LANGUAGES } from '../i18n/languages'

/**
 * The navbar language dropdown (Slice 22.21, Angel's call): ten of the
 * world's most-spoken languages behind a globe button, matching the
 * ?/palette/gear icon row. Each row is a PLAIN button on purpose — the
 * global pastel hover ring (button::before, inset -4px) only skips
 * role='option' and the rail/reel/seg classes, so plain rows wear the
 * same spinning ring as every other control in the app. The panel keeps
 * enough padding and row gap that the -4px ring never clips, and it must
 * never gain overflow:hidden (the recurring ring trap: 22.9, 22.19).
 */

function GlobeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <ellipse
        cx="12"
        cy="12"
        rx="4"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.6 9 H20.4 M3.6 15 H20.4"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

export function LanguageMenu() {
  const lang = useI18nStore((s) => s.lang)
  const setLang = useI18nStore((s) => s.setLang)
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Click outside or Escape closes the popover (same choreography as
  // the palette picker).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (
        rootRef.current !== null &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className="nav-icon"
        aria-label={t('Language')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('Language')}
        onClick={() => {
          setOpen(!open)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          padding: 0,
        }}
      >
        <GlobeIcon />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('Languages')}
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            insetInlineEnd: 0,
            minWidth: '12.5rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
            // Generous padding + row gap: each row's hover ring lives at
            // inset -4px, and it needs room to breathe on every side.
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            zIndex: 10,
          }}
        >
          {LANGUAGES.map((language) => {
            const active = language.id === lang
            return (
              <button
                key={language.id}
                type="button"
                onClick={() => {
                  setLang(language.id)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  width: '100%',
                  textAlign: 'start',
                  background: active ? 'var(--color-surface)' : 'transparent',
                  border: active
                    ? '1px solid var(--color-accent)'
                    : '1px solid transparent',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-2) var(--space-3)',
                  fontWeight: active ? 600 : 500,
                  color: 'var(--color-text)',
                }}
              >
                <span style={{ flex: 1 }}>{language.native}</span>
                {language.english !== language.native && (
                  <span
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {language.english}
                  </span>
                )}
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--color-accent)',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
