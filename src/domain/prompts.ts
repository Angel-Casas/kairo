/**
 * Prompt templates sent to text models. Model-facing, not user-facing —
 * i18n does not apply here (prompts stay English for consistent results).
 */

export function scriptSystemPrompt(
  scriptNoun = 'short-form vertical videos (YouTube Shorts)',
): string {
  return [
    `You are an expert scriptwriter for ${scriptNoun}.`,
    'Write tight, engaging narration scripts meant to be',
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
    'You split narration scripts for short videos into scenes.',
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
 * Style-from-image (Slice 12): a vision model turns a reference image into
 * reusable style notes. STYLE ONLY — naming the subject would leak scene
 * content into every image prompt the notes are prepended to.
 */
export function styleFromImageSystemPrompt(): string {
  return [
    'You describe the visual STYLE of an image so it can be reused as style',
    'notes in image-generation prompts. Name the palette (dominant colors),',
    'the lighting, the medium or rendering style (e.g. watercolor, 3D render,',
    'film photograph), and the composition or lens character. Respond with',
    'ONLY one line of comma-separated style fragments, ready to paste into an',
    'image prompt. Never mention the subject, objects, people, text, or scene',
    'content — style only.',
  ].join(' ')
}

export function styleFromImageUserText(): string {
  return 'Describe the style of this image as reusable style notes.'
}

/**
 * Motion prompt for animating a scene image into a clip. The image already
 * carries the style; the prompt describes what should MOVE. Craft rules:
 * pair the camera with an event happening in the clip (a camera move past a
 * frozen figure reads as a drifting still), one continuous action only, and
 * no text in frame.
 */
/**
 * Trim ONE trailing period from a user-written fragment — the builders
 * join fragments with '. ' themselves, so "…in the distance." became
 * "…in the distance.." in real prompts (Angel's catch, 15.13).
 * Deliberate "..." / "…" endings are left alone.
 */
export function unterminated(fragment: string): string {
  const trimmed = fragment.trim()
  if (trimmed.endsWith('.') && !trimmed.endsWith('..')) {
    return trimmed.slice(0, -1).trimEnd()
  }
  return trimmed
}

export function buildVideoPrompt(
  visualDescription: string,
  cameraNotes = '',
): string {
  const description = unterminated(visualDescription)
  const camera = unterminated(cameraNotes)
  return [
    description,
    // The user's camera direction REPLACES the gentle-drift default — a
    // "fixed tripod" note must not fight a baked-in drifting camera.
    camera.length > 0
      ? `one continuous natural action unfolds during the clip. Camera: ${camera}`
      : 'one continuous natural action unfolds during the clip, and the camera drifts gently with that action',
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
  /** The project format's composition fragment (Slice 18). */
  compositionFragment?: string
}): string {
  const parts = [
    unterminated(params.stylePromptFragment ?? ''),
    unterminated(params.styleNotes),
    ...(params.referenceDescriptors ?? []).map(unterminated),
    unterminated(params.visualDescription),
    params.compositionFragment ?? 'vertical 9:16 composition',
    'no readable text, signs, or lettering in the image',
  ].filter((p) => p.length > 0)
  return parts.join('. ')
}
