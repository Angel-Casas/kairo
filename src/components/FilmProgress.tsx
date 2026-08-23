// FilmProgress — a strip of film being exposed (ADR-013, "the
// projectionist's cut"). Long-running work in Kairo is always footage
// moving through a gate, so progress is drawn as a sprocket strip: the
// perforations march while work is running, and the exposed (accent)
// region grows left-to-right as the job completes. Indeterminate work
// shows only the marching perforations — motion without a claim about
// how much is left.
//
// `value` is a 0..1 fraction; omit it (or pass null) for indeterminate.
// The bar carries role="progressbar" so screen readers hear the same
// story sighted users see.
export function FilmProgress({
  value,
  label,
}: {
  value?: number | null
  label?: string
}) {
  const determinate = typeof value === 'number' && Number.isFinite(value)
  const fraction = determinate ? Math.min(1, Math.max(0, value)) : null
  return (
    <div
      className={`film-progress${fraction === null || fraction < 1 ? ' marching' : ''}`}
      role="progressbar"
      aria-label={label ?? 'Progress'}
      {...(fraction !== null
        ? {
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(fraction * 100),
          }
        : {})}
    >
      <div className="sprockets" />
      {fraction !== null && (
        <div className="exposed" style={{ width: `${fraction * 100}%` }} />
      )}
    </div>
  )
}
