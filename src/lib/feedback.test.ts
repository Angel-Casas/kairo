import { describe, expect, it } from 'vitest'
import { buildIssueUrl, GITHUB_REPO_URL } from './feedback'

describe('buildIssueUrl', () => {
  it('prefixes the title with the kind and encodes everything', () => {
    const url = buildIssueUrl({
      kind: 'bug',
      summary: 'Export stays disabled & spins',
      details: 'Steps:\n1. Do a thing\n2. Boom',
    })
    expect(url.startsWith(`${GITHUB_REPO_URL}/issues/new?`)).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('title')).toBe('[Bug] Export stays disabled & spins')
    expect(params.get('body')).toBe(
      "Steps:\n1. Do a thing\n2. Boom\n\n---\n_Sent from Kairo's feedback overlay._",
    )
  })

  it('handles suggestions with empty details', () => {
    const url = buildIssueUrl({
      kind: 'suggestion',
      summary: '  Let scenes reorder by drag  ',
      details: '   ',
    })
    const params = new URL(url).searchParams
    expect(params.get('title')).toBe('[Suggestion] Let scenes reorder by drag')
    expect(params.get('body')).toBe("_Sent from Kairo's feedback overlay._")
  })

  it('labels questions as questions', () => {
    const params = new URL(
      buildIssueUrl({
        kind: 'question',
        summary: 'How do refs work?',
        details: '',
      }),
    ).searchParams
    expect(params.get('title')).toBe('[Question] How do refs work?')
  })
})
