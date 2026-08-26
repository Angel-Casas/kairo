import { useEffect, useRef, useState } from 'react'
import { THEMES, getTheme, type Theme } from '../domain/themes'
import { activeThemeId, useSettingsStore } from '../state/settings'

/**
 * The navbar palette dropdown (ADR-010 follow-up): one control for all ten
 * palettes, light and dark alike — picking a palette also switches to its
 * mode, so there is no separate light/dark toggle. The trigger shows the
 * active palette as a 2×2 swatch tile; each row pairs a tile with the
 * palette name, and the active row is ringed with a dot marker.
 */

/** The four colors that summarize a palette: ground, cool, accent, warm. */
function swatchColors(theme: Theme): string[] {
  return [
    theme.bg,
    `rgb(${theme.bubbleCool})`,
    theme.accent,
    `rgb(${theme.bubbleWarm})`,
  ]
}

function SwatchTile({ theme, size }: { theme: Theme; size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2px',
        width: `${String(size)}px`,
        height: `${String(size)}px`,
        flexShrink: 0,
      }}
    >
      {swatchColors(theme).map((color, i) => (
        <span
          key={i}
          style={{
            background: color,
            borderRadius: '4px',
            border: '1px solid var(--color-border)',
          }}
        />
      ))}
    </span>
  )
}

export function PalettePicker() {
  const themeMode = useSettingsStore((s) => s.themeMode)
  const darkThemeId = useSettingsStore((s) => s.darkThemeId)
  const lightThemeId = useSettingsStore((s) => s.lightThemeId)
  const chooseTheme = useSettingsStore((s) => s.chooseTheme)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const currentId = activeThemeId({ themeMode, darkThemeId, lightThemeId })
  const current = getTheme(currentId)

  // Click outside or Escape closes the popover.
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

  if (current === null) return null

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className="nav-icon"
        aria-label="Color palette"
        aria-haspopup="listbox"
        aria-expanded={open}
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
        <SwatchTile theme={current} size={20} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Color palettes"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            // Logical, not physical (22.21.2, Angel's report): `right: 0`
            // kept anchoring the panel's right edge in RTL too, where the
            // nav icons sit at the LEFT of the screen — the palette list
            // opened straight off-screen. inset-inline-end follows the
            // reading direction, same as the language menu.
            insetInlineEnd: 0,
            minWidth: '13rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            zIndex: 10,
          }}
        >
          {THEMES.map((theme) => {
            const active = theme.id === currentId
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  chooseTheme(theme.id)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  textAlign: 'left',
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
                <SwatchTile theme={theme} size={22} />
                <span style={{ flex: 1 }}>{theme.name}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--color-accent)',
                      flexShrink: 0,
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
