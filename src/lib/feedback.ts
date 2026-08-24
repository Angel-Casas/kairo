/**
 * Feedback lands on GitHub (Slice 19, Angel's call): Kairo has no backend,
 * and the project is open source — issues are where bugs and ideas belong.
 * The overlay composes a prefilled new-issue URL; nothing is sent from the
 * app itself, and nothing but what the user typed goes into the URL.
 */

// TODO(angel): point at the real repository URL (owner/repo), then the
// landing page's GitHub links can share it too.
export const GITHUB_REPO_URL = 'https://github.com/your-user/kairo'

export type FeedbackKind = 'bug' | 'suggestion' | 'question'

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string }[] = [
  { id: 'bug', label: 'Bug report' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'question', label: 'Question' },
]

const KIND_PREFIX: Record<FeedbackKind, string> = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  question: 'Question',
}

/** The prefilled new-issue URL. Only user-typed text goes in. */
export function buildIssueUrl(params: {
  kind: FeedbackKind
  summary: string
  details: string
}): string {
  const title = `[${KIND_PREFIX[params.kind]}] ${params.summary.trim()}`
  const body =
    params.details.trim().length > 0
      ? `${params.details.trim()}\n\n---\n_Sent from Kairo's feedback overlay._`
      : "_Sent from Kairo's feedback overlay._"
  const query = new URLSearchParams({ title, body })
  return `${GITHUB_REPO_URL}/issues/new?${query.toString()}`
}
