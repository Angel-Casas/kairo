import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="Delete everything?"
      message="This cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog a11y behavior', () => {
  it('moves focus to the safe (Cancel) button on open', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('cancels on Escape', async () => {
    const user = userEvent.setup()
    const { onCancel, onConfirm } = renderDialog()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('is announced as a modal dialog', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Delete everything?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})
