/**
 * Defensive parsing of model-produced scene breakdowns. LLM output is the
 * least trustworthy input in the app: it may be wrapped in code fences,
 * surrounded by prose, malformed, or missing fields. Anything invalid throws
 * SceneParseError with a message suitable for showing to the user.
 */

export interface ParsedScene {
  textExcerpt: string
  visualDescription: string
}

export const MAX_SCENES = 30

export class SceneParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneParseError'
  }
}

export function parseSceneBreakdown(content: string): ParsedScene[] {
  // Locate the outermost JSON array, ignoring fences/prose around it.
  const start = content.indexOf('[')
  const end = content.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    throw new SceneParseError(
      'The model did not return a scene list. Try again or pick another model.',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(start, end + 1))
  } catch {
    throw new SceneParseError(
      'The model returned malformed scene data. Try again or pick another model.',
    )
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new SceneParseError(
      'The model returned an empty scene list. Try again or pick another model.',
    )
  }
  if (parsed.length > MAX_SCENES) {
    throw new SceneParseError(
      `The model returned ${String(parsed.length)} scenes (limit ${String(MAX_SCENES)}). Try again with clearer instructions.`,
    )
  }

  return parsed.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new SceneParseError(
        `Scene ${String(index + 1)} in the model output is not an object.`,
      )
    }
    const record = item as Record<string, unknown>
    const textExcerpt =
      typeof record.textExcerpt === 'string' ? record.textExcerpt.trim() : ''
    const visualDescription =
      typeof record.visualDescription === 'string'
        ? record.visualDescription.trim()
        : ''
    if (textExcerpt.length === 0 || visualDescription.length === 0) {
      throw new SceneParseError(
        `Scene ${String(index + 1)} in the model output is missing its text or visual description.`,
      )
    }
    return { textExcerpt, visualDescription }
  })
}
