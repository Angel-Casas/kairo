import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../state/settings'
import { MotionSettings } from './MotionSettings'

function mockMatchMedia(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion') ? reduced : false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  useSettingsStore.setState({ motionMode: 'system' })
})

describe('MotionSettings (15.17.1)', () => {
  it('explains that the OS is suppressing motion — the silent state made animations "not work"', () => {
    mockMatchMedia(true)
    render(<MotionSettings />)
    expect(screen.getByLabelText('Motion preference')).toHaveValue('system')
    expect(screen.getByText(/system asks apps to reduce motion/)).toBeTruthy()
  })

  it('no hint when the OS allows motion', () => {
    mockMatchMedia(false)
    render(<MotionSettings />)
    expect(screen.queryByText(/reduce motion/)).toBeNull()
  })

  it('persists the override', async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    render(<MotionSettings />)
    await user.selectOptions(screen.getByLabelText('Motion preference'), 'on')
    expect(useSettingsStore.getState().motionMode).toBe('on')
    expect(localStorage.getItem('kairo.ui.motion')).toBe('on')
  })
})
