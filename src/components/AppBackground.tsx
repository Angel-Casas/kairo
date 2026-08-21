/**
 * The themed backdrop (ADR-010): huge soft color bubbles blending into the
 * ground color, under a fine diagonal hatch. All colors flow from the theme
 * tokens; geometry lives in index.css. Static for now — the animation pass
 * will let it drift.
 */
export function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="bubble-cool-1"></div>
      <div className="bubble-cool-2"></div>
      <div className="bubble-warm-1"></div>
      <div className="bubble-warm-2"></div>
      <div className="bubble-bridge"></div>
      <div className="hatch"></div>
    </div>
  )
}
