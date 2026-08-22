import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TtsModel } from '../api/nanogpt'
import { useProjectStore } from '../state/project'
import { VoicePicker } from './VoicePicker'

const MODEL: TtsModel = {
  id: 'Kokoro-82m',
  name: 'Kokoro 82M',
  description: '',
  pricing: { kind: 'perKChars', usdPerKChars: 0.0017 },
  voices: ['af_bella', 'am_adam', 'bm_george'],
  maxInputChars: 10_000,
  releasedAt: null,
}

const previewVoice = vi.fn()

beforeEach(() => {
  previewVoice.mockReset()
  useProjectStore.setState({
    previewVoice: previewVoice as never,
  })
})

describe('VoicePicker (Slice 15.9)', () => {
  it('opens the menu with humanized labels and selects a voice', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<VoicePicker model={MODEL} voice="af_bella" onSelect={onSelect} />)

    const trigger = screen.getByRole('button', { name: 'Voice' })
    expect(trigger.textContent).toContain('Bella — American female')
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Voice menu' })
    // The exact once-only preview price is stated up front.
    expect(dialog.textContent).toContain('then replays free from cache')
    await user.click(
      screen.getByRole('option', { name: 'George — British male' }),
    )
    expect(onSelect).toHaveBeenCalledWith('bm_george')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the ▶ button asks the store for a preview and surfaces the REAL error', async () => {
    const user = userEvent.setup()
    previewVoice.mockResolvedValue({
      ok: false,
      error: 'Insufficient balance for this model.', // the API's own words
    })
    render(
      <VoicePicker model={MODEL} voice="af_bella" onSelect={() => undefined} />,
    )
    await user.click(screen.getByRole('button', { name: 'Voice' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Preview voice Adam — American male',
      }),
    )
    expect(previewVoice).toHaveBeenCalledWith(MODEL, 'am_adam')
    expect(
      await screen.findByText('Insufficient balance for this model.'),
    ).toBeTruthy()
  })

  it('Load all fetches every missing preview at a stated exact total', async () => {
    const user = userEvent.setup()
    previewVoice.mockResolvedValue({ ok: false, error: 'unplayable' })
    render(
      <VoicePicker model={MODEL} voice="af_bella" onSelect={() => undefined} />,
    )
    await user.click(screen.getByRole('button', { name: 'Voice' }))

    // 3 uncached voices × the 45-char sample at $0.0017/1k each.
    const loadAll = await screen.findByRole('button', {
      name: 'Load all previews',
    })
    expect(loadAll.textContent).toContain('$0.00023')
    await user.click(loadAll)
    expect(previewVoice).toHaveBeenCalledTimes(3)
    expect(
      await screen.findByText(/3 of 3 previews returned no playable audio/i),
    ).toBeTruthy()
  })
})
