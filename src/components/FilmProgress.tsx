// FilmProgress — a strip of film being developed (ADR-013, "the
// projectionist's cut"; 15.17.6 pastel restyle at Angel's request).
// Long-running work is footage in the developing bath: a slow river of
// pastel color flows through the strip while work runs. Determinate work
// grows the developed (gradient) length left-to-right over the faintly
// perforated unexposed remainder; indeterminate work floods the whole
// strip with the flowing gradient — motion without a claim about how
// much is left.
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
      className={`film-progress${fraction === null ? ' indeterminate' : ''}${fraction === null || fraction < 1 ? ' marching' : ''}`}
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
