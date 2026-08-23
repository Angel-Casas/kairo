import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FilmProgress } from './FilmProgress'

describe('FilmProgress (Slice 15.17)', () => {
  it('reports determinate progress via the progressbar role', () => {
    render(<FilmProgress value={0.4} label="All images progress" />)
    const bar = screen.getByRole('progressbar', {
      name: 'All images progress',
    })
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.className).toContain('marching')
  })

  it('indeterminate mode claims no value, only motion', () => {
    render(<FilmProgress label="Script generating" />)
    const bar = screen.getByRole('progressbar', { name: 'Script generating' })
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
    expect(bar.className).toContain('marching')
  })

  it('clamps out-of-range values and stops marching at 100%', () => {
    render(<FilmProgress value={1.7} label="Done" />)
    const bar = screen.getByRole('progressbar', { name: 'Done' })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
    expect(bar.className).not.toContain('marching')
  })
})
