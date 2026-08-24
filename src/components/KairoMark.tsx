/**
 * The Kairo mark — "Projector K" (Slice 20, Angel's pick from the logo
 * canvas): a K whose arms are projector beams leaving the lens, with the
 * lens as a golden spark. Strokes ride currentColor so the mark inherits
 * text color anywhere it sits; the spark defaults to the theme accent.
 */
export function KairoMark({
  size = 22,
  spark = 'var(--color-accent)',
}: {
  size?: number
  spark?: string
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect
        x="4.8"
        y="3.8"
        width="3.1"
        height="16.4"
        rx="1.55"
        fill="currentColor"
      />
      <path
        d="M9.4 12 L19.8 4.6 M9.4 12 L19.8 19.4"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
      />
      <circle cx="9.4" cy="12" r="1.7" fill={spark} />
    </svg>
  )
}
