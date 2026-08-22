import { useState } from 'react'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'

/**
 * Always-visible project spend, per the cost-transparency principle.
 * Totals prefer actual costs (from API-reported usage) and fall back to
 * estimates when a provider reports no usage.
 */
export function CostSummary() {
  const project = useProjectStore((s) => s.project)
  const [expanded, setExpanded] = useState(false)

  if (project === null || project.costLog.length === 0) return null

  const totalUsd = project.costLog.reduce(
    (sum, entry) => sum + (entry.actualUsd ?? entry.estimatedUsd ?? 0),
    0,
  )
  const allActual = project.costLog.every((e) => e.actualUsd !== null)

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-2) var(--space-4)',
        marginBottom: 'var(--space-4)',
        fontSize: 'var(--text-sm)',
      }}
    >
      <span aria-label="Project spend">
        Spent: {allActual ? '' : '~'}
        {formatUsd(totalUsd)} ({String(project.costLog.length)}{' '}
        {project.costLog.length === 1 ? 'generation' : 'generations'})
      </span>{' '}
      <button
        type="button"
        onClick={() => {
          setExpanded(!expanded)
        }}
      >
        {expanded ? 'Hide details' : 'Details'}
      </button>
      {expanded && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 'var(--space-2) 0 0',
          }}
        >
          {[...project.costLog].reverse().map((entry) => (
            <li
              key={entry.id}
              style={{
                color: 'var(--color-text-muted)',
                padding: 'var(--space-1) 0',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {new Date(entry.at).toLocaleString()} — {entry.note} (
              {entry.model}) — estimated{' '}
              {entry.estimatedUsd !== null
                ? `up to ~${formatUsd(entry.estimatedUsd)}`
                : 'unknown'}
              , actual{' '}
              {entry.actualUsd !== null
                ? formatUsd(entry.actualUsd)
                : 'not reported'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
