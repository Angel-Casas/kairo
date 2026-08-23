import type { Stage, StageItem } from '../domain/stages'

/**
 * The transport deck (ADR-011, Filmstrip design): pipeline navigation as a
 * film-leader scrubber. One center line holds the previous-stage button, the
 * track (progress fill, stop dots, playhead), and the next-stage button;
 * below sits the segmented rail — one continuous control with a named,
 * clickable segment per stage.
 */

/** Punched-reel check: an amber disc with a check cut into it (done). */
function DoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6.6" fill="var(--color-accent)" />
      <circle
        cx="7.5"
        cy="7.5"
        r="6.6"
        fill="none"
        stroke="rgba(0, 0, 0, 0.25)"
        strokeWidth="1"
      />
      <path
        d="M4.4 7.7 L6.6 9.9 L10.7 5.2"
        fill="none"
        stroke="var(--color-cta-text)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Aperture mark: ring with a core and four sight lines (current stage). */
function NowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <circle
        cx="7.5"
        cy="7.5"
        r="6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="7.5" cy="7.5" r="2.6" fill="currentColor" />
      <path
        d="M7.5 1.3 V3.1 M13.7 7.5 H11.9 M7.5 13.7 V11.9 M1.3 7.5 H3.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Film-canister padlock: flat shackle over a canister body (locked). */
function LockIcon() {
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" aria-hidden="true">
      <path
        d="M4.2 6.4 V4.6 a2.8 2.8 0 0 1 5.6 0 V6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="2.6"
        y="6.4"
        width="8.8"
        height="6.6"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 8.6 V10.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PrevGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 3 V13"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M12.5 3.6 L6.8 8 L12.5 12.4 Z" fill="currentColor" />
    </svg>
  )
}

function NextGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M12.5 3 V13"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M3.5 3.6 L9.2 8 L3.5 12.4 Z" fill="currentColor" />
    </svg>
  )
}

export function StagesNav({
  stages,
  active,
  onSelect,
  progressNote,
}: {
  stages: StageItem[]
  active: Stage
  onSelect: (stage: Stage) => void
  /** Short status for the current stage shown in its segment, e.g. "4/6". */
  progressNote?: string | null
}) {
  const activeIndex = stages.findIndex((s) => s.id === active)
  const prev = activeIndex > 0 ? stages[activeIndex - 1] : undefined
  const next =
    activeIndex < stages.length - 1 ? stages[activeIndex + 1] : undefined
  const fillPct = (activeIndex / (stages.length - 1)) * 100

  return (
    <nav
      aria-label="Pipeline stages"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
      }}
    >
      {/* Deck row: previous · track · next, all on one center line. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <button
          type="button"
          aria-label={
            prev !== undefined
              ? `Previous stage: ${prev.label}`
              : 'No earlier stage'
          }
          disabled={prev === undefined || !prev.available}
          onClick={() => {
            if (prev !== undefined) onSelect(prev.id)
          }}
          style={{
            width: '44px',
            height: '44px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PrevGlyph />
        </button>

        <div
          aria-hidden="true"
          style={{ position: 'relative', flex: 1, height: '44px' }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: '10px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${String(fillPct)}%`,
                background:
                  'linear-gradient(90deg, var(--color-accent-soft), var(--color-accent))',
                // The tape spools to the new stage instead of teleporting.
                transition: 'width var(--t-slow) var(--ease-film)',
              }}
            />
            {/* Sprocket texture, like the reel's perforations. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'repeating-linear-gradient(90deg, var(--hatch-line) 0 2px, transparent 2px 26px)',
              }}
            />
          </div>
          {stages.map((stage, i) => (
            <div
              key={stage.id}
              style={{
                position: 'absolute',
                left: `${String((i / (stages.length - 1)) * 100)}%`,
                top: '50%',
                transform: `translate(${i === 0 ? '0' : i === stages.length - 1 ? '-100%' : '-50%'}, -50%)`,
                width: '8px',
                height: '8px',
                borderRadius: 'var(--radius-pill)',
                background:
                  i <= activeIndex
                    ? 'var(--color-cta-bg)'
                    : 'var(--color-border)',
                // Dots light up as the playhead passes them, on the same
                // clock as its travel.
                transition: 'background-color var(--t-slow) var(--ease-film)',
              }}
            />
          ))}
          {/* Playhead — glides along the tape between stages (15.17.2),
              on the same clock as the fill so needle and tape arrive
              together. */}
          <div
            style={{
              position: 'absolute',
              left: `${String(fillPct)}%`,
              top: '2px',
              transform: 'translateX(-50%)',
              width: '3px',
              height: '40px',
              background: 'var(--color-cta-bg)',
              borderRadius: '2px',
              boxShadow: '0 0 14px var(--color-accent-soft)',
              transition: 'left var(--t-slow) var(--ease-film)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${String(fillPct)}%`,
              top: '-4px',
              transform: 'translateX(-50%)',
              width: '15px',
              height: '11px',
              background: 'var(--color-cta-bg)',
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              transition: 'left var(--t-slow) var(--ease-film)',
            }}
          />
        </div>

        <button
          type="button"
          className="primary"
          aria-label={
            next !== undefined ? `Next stage: ${next.label}` : 'Final stage'
          }
          title={next?.hint ?? undefined}
          disabled={next === undefined || !next.available}
          onClick={() => {
            if (next !== undefined) onSelect(next.id)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            height: '44px',
            flexShrink: 0,
          }}
        >
          {/* Every possible label occupies the same grid cell; only the
              current one is visible. The button is always as wide as the
              widest label, so it never resizes — and the track (flex: 1)
              never breathes when the stage changes. */}
          <span style={{ display: 'grid' }}>
            {[...stages.slice(1).map((s) => s.label), 'The wrap'].map(
              (label) => (
                <span
                  key={label}
                  aria-hidden={label !== (next?.label ?? 'The wrap')}
                  style={{
                    gridArea: '1 / 1',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    visibility:
                      label === (next?.label ?? 'The wrap')
                        ? 'visible'
                        : 'hidden',
                  }}
                >
                  {label}
                </span>
              ),
            )}
          </span>
          <NextGlyph />
        </button>
      </div>

      {/* Segmented rail: one control, five named segments. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: '44px',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {stages.map((stage, i) => {
          const isActive = stage.id === active
          const isDone = i < activeIndex
          // Filled segments (done + active) must touch with no gap; the
          // hairline separator only survives between two unfilled ones.
          const nextFilled = i + 1 <= activeIndex
          const showSeparator =
            i < stages.length - 1 && !isActive && !isDone && !nextFilled
          return (
            <button
              key={stage.id}
              type="button"
              className="rail-segment"
              disabled={!stage.available}
              aria-current={isActive ? 'step' : undefined}
              title={stage.hint ?? undefined}
              onClick={() => {
                onSelect(stage.id)
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                border: 'none',
                borderRight: showSeparator
                  ? '1px solid var(--color-border)'
                  : 'none',
                // Fill the whole cell — the rail's own rounded corners clip
                // the first and last segment, so no per-segment radius.
                borderRadius: 0,
                margin: 0,
                cursor: stage.available ? 'pointer' : 'not-allowed',
                fontWeight: isActive ? 700 : 500,
                // backgroundColor (not the `background` shorthand): the
                // shorthand would reset background-image inline and defeat
                // the CSS hover tint overlay (15.17.7).
                backgroundColor: isActive
                  ? 'var(--color-cta-bg)'
                  : isDone
                    ? 'var(--color-accent-soft)'
                    : 'transparent',
                color: isActive
                  ? 'var(--color-cta-text)'
                  : isDone
                    ? 'var(--color-text)'
                    : 'var(--color-text-muted)',
                boxShadow: isActive ? '0 6px 18px rgba(0, 0, 0, 0.3)' : 'none',
                opacity: stage.available || isDone ? 1 : 0.6,
                // The lit segment hands off smoothly instead of blinking.
                transition:
                  'background-color var(--t-slow) var(--ease-film), color var(--t-slow) var(--ease-film), box-shadow var(--t-slow) var(--ease-film), opacity var(--t-med) var(--ease-film)',
              }}
            >
              {/* Inner wrapper so the hover growth scales the text+icon
                  only, never the segment box (which would tear the rail). */}
              <span className="rail-label">
                {isDone ? (
                  <DoneIcon />
                ) : isActive ? (
                  <NowIcon />
                ) : stage.available ? null : (
                  <LockIcon />
                )}
                {stage.label}
                {isActive && progressNote != null && (
                  <span
                    aria-hidden="true"
                    style={{ fontSize: '11px', fontWeight: 700, opacity: 0.7 }}
                  >
                    {progressNote}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
