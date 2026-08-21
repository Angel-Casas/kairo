import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AssetVersion } from '../domain/types'
import { GenerationHistory } from './GenerationHistory'

function version(overrides: Partial<AssetVersion> = {}): AssetVersion {
  return {
    id: crypto.randomUUID(),
    kind: 'image',
    model: 'img/model',
    prompt: 'watercolor. a castle at dawn',
    costUsd: 0.012,
    blobPath: 'p/v',
    mimeType: 'image/png',
    createdAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  }
}

describe('GenerationHistory', () => {
  it('renders nothing without versions', () => {
    const { container } = render(
      <GenerationHistory versions={[]} activeVersionId={null} label="X" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists versions newest-first with prompt, model, and cost', () => {
    const v1 = version({ prompt: 'first prompt' })
    const v2 = version({ prompt: 'second prompt', costUsd: 0.02 })
    render(
      <GenerationHistory
        versions={[v1, v2]}
        activeVersionId={v2.id}
        label="Scene 1 image"
      />,
    )
    const rows = screen.getAllByLabelText(/Scene 1 image version \d details/)
    expect(rows).toHaveLength(2)
    // Newest (version 2) first.
    expect(rows[0]).toHaveTextContent('Version 2')
    expect(rows[0]).toHaveTextContent('second prompt')
    expect(rows[0]).toHaveTextContent('active')
    expect(rows[0]).toHaveTextContent('$0.02')
    expect(rows[1]).toHaveTextContent('Version 1')
    expect(rows[1]).toHaveTextContent('first prompt')
    expect(rows[1]).not.toHaveTextContent('active')
  })

  it('copies the exact prompt to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const v = version({ prompt: 'the exact stored prompt' })
    render(
      <GenerationHistory
        versions={[v]}
        activeVersionId={v.id}
        label="Scene 1 image"
      />,
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Copy Scene 1 image version 1 prompt',
      }),
    )
    expect(writeText).toHaveBeenCalledWith('the exact stored prompt')
    expect(screen.getByRole('button', { name: /Copy/ })).toHaveTextContent(
      'Copied',
    )
  })

  it('labels imported versions and stores having no prompt honestly', () => {
    const imported = version({ model: 'imported', prompt: '', costUsd: null })
    render(
      <GenerationHistory
        versions={[imported]}
        activeVersionId={imported.id}
        label="Reference Mara"
      />,
    )
    expect(screen.getByText('imported file')).toBeInTheDocument()
    expect(screen.getByText('free')).toBeInTheDocument()
    expect(
      screen.getByText('No prompt was stored for this version.'),
    ).toBeInTheDocument()
    // No copy or tweak controls without a prompt.
    expect(screen.queryByRole('button', { name: /Copy/ })).toBeNull()
  })

  it('edit & regenerate sends the edited text and closes the editor', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn()
    const v = version({ prompt: 'original prompt' })
    render(
      <GenerationHistory
        versions={[v]}
        activeVersionId={v.id}
        label="Scene 1 image"
        onRegenerate={onRegenerate}
        regenerateCostUsd={0.012}
      />,
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Edit and regenerate from Scene 1 image version 1',
      }),
    )
    const textarea = screen.getByLabelText(
      'Scene 1 image version 1 edited prompt',
    )
    expect(textarea).toHaveValue('original prompt')
    await user.clear(textarea)
    await user.type(textarea, 'tweaked prompt')
    await user.click(
      screen.getByRole('button', { name: 'Generate with this prompt' }),
    )
    expect(onRegenerate).toHaveBeenCalledWith('tweaked prompt')
    expect(
      screen.queryByLabelText('Scene 1 image version 1 edited prompt'),
    ).toBeNull()
  })

  it('offers no regenerate controls when onRegenerate is absent (videos)', () => {
    const v = version({ kind: 'video', prompt: 'motion prompt' })
    render(
      <GenerationHistory
        versions={[v]}
        activeVersionId={v.id}
        label="Scene 1 clip"
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Edit and regenerate/ }),
    ).toBeNull()
    expect(
      screen.getByRole('button', {
        name: 'Copy Scene 1 clip version 1 prompt',
      }),
    ).toBeInTheDocument()
  })

  it('disables generate with an empty edited prompt', async () => {
    const user = userEvent.setup()
    const v = version()
    render(
      <GenerationHistory
        versions={[v]}
        activeVersionId={v.id}
        label="Scene 1 image"
        onRegenerate={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Edit and regenerate from Scene 1 image version 1',
      }),
    )
    await user.clear(
      screen.getByLabelText('Scene 1 image version 1 edited prompt'),
    )
    expect(
      screen.getByRole('button', { name: 'Generate with this prompt' }),
    ).toBeDisabled()
  })
})
