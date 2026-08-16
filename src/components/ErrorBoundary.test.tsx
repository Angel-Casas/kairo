import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows the recovery screen instead of a white page on a crash', () => {
    // React logs the error loudly; keep test output clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    spy.mockRestore()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(
      screen.getByRole('button', { name: 'Reload Kairo' }),
    ).toBeInTheDocument()
  })
})
