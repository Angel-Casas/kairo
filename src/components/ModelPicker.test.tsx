import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextModel } from '../api/nanogpt'
import { useModelsStore } from '../state/models'
import { TextModelPicker, VideoModelPicker } from './ModelPicker'

function model(
  id: string,
  name: string,
  releasedAt: string | null = null,
): TextModel {
  return {
    id,
    name,
    description: '',
    promptPricePerMTok: 1,
    completionPricePerMTok: 2,
    supportsVision: false,
    releasedAt,
  }
}

beforeEach(() => {
  useModelsStore.setState({
    textModels: [
      model('openai/alpha', 'Alpha Writer', '2026-05-12T00:00:00Z'),
      model('anthropic/beta', 'Beta Coder'),
      model('c/gamma', 'Gamma Writer'),
    ],
    textModelsStatus: 'ready',
  })
})

describe('TextModelPicker (model menu)', () => {
  it('opens the menu, groups by provider, and searches by name', async () => {
    const user = userEvent.setup()
    render(<TextModelPicker selectedId={null} onSelect={() => undefined} />)

    // Trigger shows the placeholder with a count.
    const trigger = screen.getByRole('button', { name: 'Text model' })
    expect(trigger.textContent).toContain('Choose a model… (3 available)')
    await user.click(trigger)

    // All three models, provider-grouped headers present.
    expect(screen.getAllByRole('option')).toHaveLength(3)
    const dialog = screen.getByRole('dialog', { name: 'Text model menu' })
    expect(dialog.textContent).toContain('OpenAI')
    expect(dialog.textContent).toContain('Anthropic')
    expect(dialog.textContent).toContain('Other')
    // Release-date chip renders for the dated model.
    expect(dialog.textContent).toContain('May 2026')

    await user.type(screen.getByLabelText('Filter text models'), 'writer')
    const labels = screen.getAllByRole('option').map((o) => o.textContent ?? '')
    expect(labels.some((l) => l.includes('Alpha Writer'))).toBe(true)
    expect(labels.some((l) => l.includes('Gamma Writer'))).toBe(true)
    expect(labels.some((l) => l.includes('Beta Coder'))).toBe(false)
  })

  it('filters by provider and resets with All', async () => {
    const user = userEvent.setup()
    render(<TextModelPicker selectedId={null} onSelect={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Text model' }))

    await user.click(screen.getByRole('button', { name: /Anthropic/ }))
    const labels = screen.getAllByRole('option').map((o) => o.textContent ?? '')
    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Beta Coder')

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('sorts by name when asked', async () => {
    const user = userEvent.setup()
    render(<TextModelPicker selectedId={null} onSelect={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Text model' }))
    await user.click(screen.getByRole('button', { name: 'Name' }))
    const labels = screen.getAllByRole('option').map((o) => o.textContent ?? '')
    expect(labels[0]).toContain('Alpha Writer')
    expect(labels[1]).toContain('Beta Coder')
    expect(labels[2]).toContain('Gamma Writer')
  })

  it('calls onSelect with the chosen model and closes', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TextModelPicker selectedId={null} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Text model' }))
    await user.click(screen.getByRole('option', { name: /openai\/alpha/ }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'openai/alpha' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('VideoModelPicker in lip-sync mode (15.16.1)', () => {
  it('shows each model\u2019s own description so the choice is informed', async () => {
    const user = userEvent.setup()
    useModelsStore.setState({
      videoModels: [
        {
          id: 'wan-wavespeed-s2v',
          name: 'Wan 2.2 S2V',
          description:
            'Speech-to-video: syncs lips and body to a provided audio track.',
          supportsTextToVideo: false,
          supportsImageToVideo: true,
          priceRangeUsd: { min: 0.04, max: 0.08 },
          resolutions: ['480p', '720p'],
          durations: [],
          frameControl: null,
          lipSync: { perSecondUsd: { '480p': 0.04, '720p': 0.08 } },
          releasedAt: null,
        },
        {
          id: 'plain-i2v',
          name: 'Plain Animator',
          description: 'Ordinary image-to-video.',
          supportsTextToVideo: false,
          supportsImageToVideo: true,
          priceRangeUsd: { min: 0.5, max: 0.5 },
          resolutions: ['480p'],
          durations: ['5'],
          frameControl: null,
          lipSync: null,
          releasedAt: null,
        },
      ],
      videoModelsStatus: 'ready',
    })
    render(
      <VideoModelPicker
        selectedId={null}
        onSelect={() => undefined}
        onlyLipSync
        ariaLabel="Lip-sync model"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Lip-sync model' }))
    const dialog = screen.getByRole('dialog', { name: 'Lip-sync model menu' })
    // Only lip-sync-capable models, each with its own description line
    // and per-SECOND pricing.
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(dialog.textContent).toContain(
      'Speech-to-video: syncs lips and body to a provided audio track.',
    )
    expect(dialog.textContent).toContain('$0.04\u2013')
    expect(dialog.textContent).not.toContain('Plain Animator')
  })
})
