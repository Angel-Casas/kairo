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

export function sceneBreakdownSystemPrompt(): string {
  return [
    'You split narration scripts for short vertical videos into scenes.',
    'Respond with ONLY a JSON array, no prose, no code fences. Each element:',
    '{"textExcerpt": "<the exact part of the script this scene covers>",',
    '"visualDescription": "<one vivid sentence describing the image for this',
    'scene: subject, setting, mood, composition. No camera jargon.>"}',
    'Use 5-10 scenes. Cover the whole script in order without gaps.',
    'Each scene depicts exactly ONE action or moment — never a sequence of',
    'actions (split multi-action beats into separate scenes instead).',
    'Visual descriptions must never rely on readable text, signs, screens,',
    'or lettering in the image — video models render text badly.',
  ].join(' ')
}

export function sceneBreakdownUserPrompt(script: string): string {
  return `Split this script into scenes:\n\n${script}`
}

/**
 * Motion prompt for animating a scene image into a clip. The image already
 * carries the style; the prompt describes what should MOVE. Craft rules:
 * pair the camera with an event happening in the clip (a camera move past a
 * frozen figure reads as a drifting still), one continuous action only, and
 * no text in frame.
 */
export function buildVideoPrompt(visualDescription: string): string {
  const description = visualDescription.trim()
  return [
    description,
    'one continuous natural action unfolds during the clip, and the camera drifts gently with that action',
    'no frozen figures, no readable text or lettering anywhere in the frame',
    'keep the original style, palette, and composition of the image',
  ]
    .filter((p) => p.length > 0)
    .join('. ')
}

/**
 * Compose the image prompt for a scene: style preset fragment (base look),
 * then project style notes (fine-tuning), then the descriptors of the
 * references the scene uses — VERBATIM, never shortened (Slice 10: the
 * model has no memory, so consistency lives in repeating the exact same
 * words) — then the scene's visual description. Empty parts are skipped.
 */
export function buildImagePrompt(params: {
  stylePromptFragment: string | null
  styleNotes: string
  referenceDescriptors?: string[]
  visualDescription: string
}): string {
  const parts = [
    params.stylePromptFragment?.trim() ?? '',
    params.styleNotes.trim(),
    ...(params.referenceDescriptors ?? []).map((d) => d.trim()),
    params.visualDescription.trim(),
    'vertical 9:16 composition',
    'no readable text, signs, or lettering in the image',
  ].filter((p) => p.length > 0)
  return parts.join('. ')
}
