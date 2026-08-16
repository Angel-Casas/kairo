import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app shell and project list', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Kairo' })).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Projects' }),
    ).toBeInTheDocument()
  })

  it('creates a project and shows it in the list', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = await screen.findByLabelText('New project title')
    await user.type(input, 'My first short')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByText('My first short')).toBeInTheDocument()
  })
})
