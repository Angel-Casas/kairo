/**
 * The developing veil (22.15, Angel's request): while a frame is being
 * generated it sits in the developing bath — Kairo's signature pastel
 * projector ring spins around its edge while a soft beam of darkroom
 * light sweeps across the print, corner to corner. Pure decoration
 * (aria-hidden): the real status lives in the caption text and the
 * FilmProgress strip. The parent must be position:relative with
 * overflow:hidden and a border-radius for the ring to trace.
 *
 * `label` (22.15.1) floats a centered badge over the artwork —
 * "Generating…", "Animating…" — because the bottom caption alone was
 * easy to miss on a frame that already holds an image.
 */
export function DevelopingVeil({ label }: { label?: string }) {
  return (
    <div className="developing-veil" aria-hidden="true">
      <div className="developing-sweep" />
      <div className="developing-ring" />
      {label !== undefined && (
        <span className="developing-label">
          <span className="developing-spinner" />
          {label}
        </span>
      )}
    </div>
  )
}
