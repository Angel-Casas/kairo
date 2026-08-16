import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextModel } from '../api/nanogpt'
import { useModelsStore } from '../state/models'
import { TextModelPicker } from './ModelPicker'

function model(id: string, name: string): TextModel {
  return {
    id,
    name,
    description: '',
    promptPricePerMTok: 1,
    completionPricePerMTok: 2,
  }
}

beforeEach(() => {
  useModelsStore.setState({
    textModels: [
      model('a/alpha', 'Alpha Writer'),
      model('b/beta', 'Beta Coder'),
      model('c/gamma', 'Gamma Writer'),
    ],
    textModelsStatus: 'ready',
  })
})

describe('TextModelPicker', () => {
  it('filters the model list by name', async () => {
    const user = userEvent.setup()
    render(<TextModelPicker selectedId={null} onSelect={() => undefined} />)
    expect(screen.getAllByRole('option')).toHaveLength(4) // placeholder + 3

    await user.type(screen.getByLabelText('Filter models'), 'writer')
    const options = screen.getAllByRole('option')
    const labels = options.map((o) => o.textContent ?? '')
    expect(labels.some((l) => l.includes('Alpha Writer'))).toBe(true)
    expect(labels.some((l) => l.includes('Gamma Writer'))).toBe(true)
    expect(labels.some((l) => l.includes('Beta Coder'))).toBe(false)
  })

  it('keeps the selected model in the list even when filtered out', async () => {
    const user = userEvent.setup()
    render(<TextModelPicker selectedId="b/beta" onSelect={() => undefined} />)
    await user.type(screen.getByLabelText('Filter models'), 'writer')
    const labels = screen.getAllByRole('option').map((o) => o.textContent ?? '')
    expect(labels.some((l) => l.includes('Beta Coder'))).toBe(true)
  })

  it('calls onSelect with the chosen model', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TextModelPicker selectedId={null} onSelect={onSelect} />)
    await user.selectOptions(screen.getByLabelText('Text model'), 'a/alpha')
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a/alpha' }),
    )
  })
})
