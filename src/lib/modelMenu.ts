/**
 * Shared logic for the rich model menu (Slice 15.8): provider derivation
 * from model ids, compact price formatting, release-date chips, and the
 * sort orders. Pure functions — the ModelPicker renders them.
 *
 * NanoGPT's listings carry no provider field, so the provider is inferred
 * from the id the way NanoGPT's own site does it: a curated substring
 * table, with everything unmatched grouped under "Other".
 */

export interface ProviderInfo {
  name: string
  /** Hand-drawn-feeling glyph, one character, brand-colored. */
  glyph: string
  color: string
}

const PROVIDERS: { test: RegExp; name: string }[] = [
  { test: /anthropic|claude/i, name: 'Anthropic' },
  { test: /x-ai|\bxai\b|grok/i, name: 'xAI' },
  { test: /elevenlabs/i, name: 'ElevenLabs' },
  { test: /inworld/i, name: 'Inworld' },
  { test: /microsoft|vibevoice|mai-voice/i, name: 'Microsoft' },
  { test: /kokoro/i, name: 'Kokoro' },
  { test: /openai|azure-|gpt|sora|o\d-(mini|pro|preview)/i, name: 'OpenAI' },
  { test: /google|gemini|gemma|veo|imagen/i, name: 'Google' },
  { test: /deepseek/i, name: 'DeepSeek' },
  { test: /qwen|alibaba|wan-|wan\d/i, name: 'Alibaba' },
  {
    test: /mistral|ministral|codestral|magistral|mixtral|devstral/i,
    name: 'Mistral',
  },
  { test: /meta[-/]|llama/i, name: 'Meta' },
  { test: /bytedance|doubao|seedance|seedream|waver/i, name: 'ByteDance' },
  { test: /moonshot|kimi/i, name: 'Moonshot' },
  { test: /z-ai|zai-org|glm/i, name: 'Z.ai' },
  { test: /minimax/i, name: 'MiniMax' },
  { test: /kling/i, name: 'Kling' },
  { test: /flux|black-forest/i, name: 'Black Forest' },
  { test: /recraft/i, name: 'Recraft' },
  { test: /hidream/i, name: 'HiDream' },
]

const PROVIDER_STYLE: Record<string, { glyph: string; color: string }> = {
  Anthropic: { glyph: '◈', color: '#cc785c' },
  xAI: { glyph: '✕', color: '#1da1f2' },
  OpenAI: { glyph: '◐', color: '#10a37f' },
  Google: { glyph: '◆', color: '#4285f4' },
  DeepSeek: { glyph: '◇', color: '#4d6bfe' },
  Alibaba: { glyph: '◉', color: '#ff6a00' },
  Mistral: { glyph: '▲', color: '#ff7000' },
  Meta: { glyph: '◎', color: '#0668e1' },
  ByteDance: { glyph: '♪', color: '#3c8cff' },
  Moonshot: { glyph: '☾', color: '#8a7bff' },
  'Z.ai': { glyph: '✦', color: '#8e6cf0' },
  MiniMax: { glyph: '◬', color: '#ff4d6d' },
  ElevenLabs: { glyph: '⌇', color: '#9b8cff' },
  Inworld: { glyph: '✧', color: '#2fbf9b' },
  Microsoft: { glyph: '▦', color: '#00a4ef' },
  Kokoro: { glyph: '❀', color: '#e77fb3' },
  Kling: { glyph: '◺', color: '#00c2a8' },
  'Black Forest': { glyph: '◪', color: '#7aa05a' },
  Recraft: { glyph: '◖', color: '#e0a83c' },
  HiDream: { glyph: '◗', color: '#5ec8d8' },
  Other: { glyph: '●', color: '#888888' },
}

/** Infer the provider name from a model id (and display name as backup). */
export function providerOf(id: string, name = ''): string {
  const haystack = `${id} ${name}`
  for (const { test, name: provider } of PROVIDERS) {
    if (test.test(haystack)) return provider
  }
  return 'Other'
}

const OTHER_STYLE = { glyph: '●', color: '#888888' }

export function providerInfo(provider: string): ProviderInfo {
  const style = PROVIDER_STYLE[provider] ?? OTHER_STYLE
  return { name: provider, ...style }
}

/**
 * Compact per-MTok price: "$0.14", "$2", "$15". Whole dollars drop the
 * decimals; sub-dollar keeps two. (Matches the badge style in NanoGPT's
 * own picker — full precision lives in the row's title/detail line.)
 */
export function formatCompactUsd(usd: number): string {
  if (usd >= 1) {
    const rounded = Math.round(usd)
    return Math.abs(usd - rounded) < 0.005
      ? `$${String(rounded)}`
      : `$${usd.toFixed(usd < 10 ? 1 : 0)}`
  }
  return `$${usd.toFixed(2)}`
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** ISO date → "May 2026" chip text. */
export function formatReleaseMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCFullYear())}`
}

export type MenuSort =
  'provider' | 'name' | 'cheapest' | 'priciest' | 'newest' | 'oldest'

export const MENU_SORTS: { id: MenuSort; label: string; icon: string }[] = [
  { id: 'provider', label: 'Provider', icon: '◫' },
  { id: 'name', label: 'Name', icon: '↓A' },
  { id: 'cheapest', label: 'Cheapest', icon: '$↑' },
  { id: 'priciest', label: 'Priciest', icon: '$↓' },
  { id: 'newest', label: 'Newest', icon: '★' },
  { id: 'oldest', label: 'Oldest', icon: '○' },
]

export interface SortableModel {
  name: string
  provider: string
  /** Representative price for sorting; null sorts last. */
  priceSortUsd: number | null
  releasedAt: string | null
}

/** Sort a model list for the menu. Stable within equal keys. */
export function sortMenuModels<M extends SortableModel>(
  models: M[],
  sort: MenuSort,
): M[] {
  const byName = (a: M, b: M) => a.name.localeCompare(b.name)
  const price = (m: M) => m.priceSortUsd
  const time = (m: M) =>
    m.releasedAt === null ? null : new Date(m.releasedAt).getTime()
  const nullsLast =
    (get: (m: M) => number | null, direction: 1 | -1) => (a: M, b: M) => {
      const va = get(a)
      const vb = get(b)
      if (va === null && vb === null) return byName(a, b)
      if (va === null) return 1
      if (vb === null) return -1
      return va === vb ? byName(a, b) : (va - vb) * direction
    }
  const sorted = [...models]
  switch (sort) {
    case 'provider':
      sorted.sort(
        (a, b) => a.provider.localeCompare(b.provider) || byName(a, b),
      )
      break
    case 'name':
      sorted.sort(byName)
      break
    case 'cheapest':
      sorted.sort(nullsLast(price, 1))
      break
    case 'priciest':
      sorted.sort(nullsLast(price, -1))
      break
    case 'newest':
      sorted.sort(nullsLast(time, -1))
      break
    case 'oldest':
      sorted.sort(nullsLast(time, 1))
      break
  }
  return sorted
}
