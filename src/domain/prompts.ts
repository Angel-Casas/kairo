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
 * Describe-from-image for references (22.3): a vision model turns a
 * reference image into the reference's DESCRIPTOR — the text injected
 * verbatim into every ticked scene's prompt. The opposite discipline of
 * style-from-image: here the SUBJECT is exactly what we want, described
 * so completely that any model can redraw it identically.
 */
export function describeReferenceSystemPrompt(
  kind: 'character' | 'location' | 'style',
): string {
  const focus =
    kind === 'character'
      ? [
          'You describe the PERSON or CHARACTER in an image so they can be',
          'redrawn identically in other images. Name apparent age, build,',
          'face shape, skin tone, hair (color, length, style), eyes,',
          'distinctive marks, and every clothing item with its exact colors',
          'and materials.',
        ]
      : kind === 'location'
        ? [
            'You describe the PLACE in an image so it can be redrawn',
            'identically in other images. Name the architecture or terrain,',
            'materials, era, layout, dominant colors, vegetation, weather,',
            'and lighting mood.',
          ]
        : [
            'You describe the visual STYLE of an image so it can be applied',
            'to other images. Name the palette, lighting, medium or',
            'rendering style, and composition character. Never mention the',
            'subject or scene content.',
          ]
  return [
    ...focus,
    'Respond with ONLY one line of comma-separated fragments, ready to',
    'paste into an image prompt. No preamble, no lists, no camera jargon.',
  ].join(' ')
}

export function describeReferenceUserText(
  kind: 'character' | 'location' | 'style',
): string {
  return kind === 'style'
    ? 'Describe the style of this image as reusable style fragments.'
    : `Describe this ${kind} so it can be redrawn identically.`
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
  /**
   * The project's artistic style (preset fragment + style notes), woven
   * into the MOTION prompt too (21.3). Start-frame image-to-video models
   * carry the style in the input image's pixels and treat this as
   * redundant confirmation — but REFERENCE-to-video models regenerate
   * the scene from the text, using the image only for identity, and
   * without these words they fall back to their default photoreal look
   * (Angel's grok-imagine handoff clip lost the whole palette).
   */
  styleFragments: string[] = [],
): string {
  const description = unterminated(visualDescription)
  const camera = unterminated(cameraNotes)
  return [
    ...styleFragments.map(unterminated),
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
