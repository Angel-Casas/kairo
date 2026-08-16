/**
 * Prompt templates sent to text models. Model-facing, not user-facing —
 * i18n does not apply here (prompts stay English for consistent results).
 */

export function scriptSystemPrompt(): string {
  return [
    'You are an expert scriptwriter for short-form vertical videos',
    '(YouTube Shorts). Write tight, engaging narration scripts meant to be',
    'read aloud in under 60 seconds (roughly 120-150 words). Hook the viewer',
    'in the first sentence. Use simple spoken language. Return ONLY the',
    'narration text: no headings, no scene directions, no timestamps,',
    'no emojis.',
  ].join(' ')
}

export function scriptUserPrompt(instructions: string): string {
  return `Write the narration script for a short video about: ${instructions}`
}
