import { DEFAULT_PROJECT_FORMAT, type ProjectFormat } from './types'

/**
 * Video formats (Slice 18). Kairo started as a 9:16 Shorts tool, but the
 * models advertise what sizes they support — so the format is simply a
 * project choice. Everything that used to hardcode "vertical" derives from
 * this table instead: the API aspect parameter, the resolution picker's
 * target ratio, the CSS aspect-ratio of every frame in the UI, and the
 * composition fragments woven into prompts.
 */
export interface VideoFormatSpec {
  id: ProjectFormat
  /** Display name — 'Vertical'. */
  name: string
  /** Ratio label — '9:16'. */
  ratioLabel: string
  /** Where this format lives — shown as the picker hint. */
  hint: string
  /** Width / height. The resolution picker minimizes |w/h − ratio|. */
  ratio: number
  /** The value sent as the API's aspect_ratio parameter. */
  aspectParam: string
  /** CSS aspect-ratio value for frames, players, and thumbnails. */
  cssAspect: string
  /** Composition fragment appended to every image prompt. */
  promptFragment: string
  /** How the script system prompt names the destination. */
  scriptNoun: string
}

export const VIDEO_FORMATS: VideoFormatSpec[] = [
  {
    id: 'vertical',
    name: 'Vertical',
    ratioLabel: '9:16',
    hint: 'Shorts · Reels · TikTok',
    ratio: 9 / 16,
    aspectParam: '9:16',
    cssAspect: '9 / 16',
    promptFragment: 'vertical 9:16 composition',
    scriptNoun: 'short-form vertical videos (YouTube Shorts, Reels, TikTok)',
  },
  {
    id: 'widescreen',
    name: 'Widescreen',
    ratioLabel: '16:9',
    hint: 'YouTube · TV',
    ratio: 16 / 9,
    aspectParam: '16:9',
    cssAspect: '16 / 9',
    promptFragment: 'widescreen 16:9 composition',
    scriptNoun: 'short widescreen videos (YouTube)',
  },
  {
    id: 'square',
    name: 'Square',
    ratioLabel: '1:1',
    hint: 'Feeds · carousels',
    ratio: 1,
    aspectParam: '1:1',
    cssAspect: '1 / 1',
    promptFragment: 'square 1:1 composition',
    scriptNoun: 'short square-format videos (social feeds)',
  },
  {
    id: 'portrait',
    name: 'Portrait',
    ratioLabel: '4:5',
    hint: 'Instagram posts',
    ratio: 4 / 5,
    aspectParam: '4:5',
    cssAspect: '4 / 5',
    promptFragment: 'portrait 4:5 composition',
    scriptNoun: 'short portrait-format videos (Instagram)',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    ratioLabel: '21:9',
    hint: 'Trailers · film looks',
    ratio: 21 / 9,
    aspectParam: '21:9',
    cssAspect: '21 / 9',
    promptFragment: 'cinematic ultra-wide 21:9 composition',
    scriptNoun: 'short cinematic ultra-widescreen videos',
  },
]

const BY_ID = new Map(VIDEO_FORMATS.map((f) => [f.id, f]))

/** The format spec for a project — never null (unknown ids fall back). */
export function getFormatSpec(id: ProjectFormat | undefined): VideoFormatSpec {
  return (
    BY_ID.get(id ?? DEFAULT_PROJECT_FORMAT) ??
    (BY_ID.get(DEFAULT_PROJECT_FORMAT) as VideoFormatSpec)
  )
}
