/**
 * Kairo's visual themes (ADR-010): the design pass ships five dark and five
 * light palettes, user-selectable from the navbar. Every color the UI uses
 * flows from here through CSS custom properties — components never hardcode
 * hues (ADR-007's token rule, now with real values).
 */

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  id: string
  /** Display name shown in the palette dropdown. */
  name: string
  mode: ThemeMode
  /** Solid ground color behind the bubble layers. */
  bg: string
  text: string
  textMuted: string
  /** Accent for links and highlighted actions. */
  accent: string
  /** Soft accent fill for chips and ticked states (rgba). */
  accentSoft: string
  /** Primary (call-to-action) button colors. */
  ctaBg: string
  ctaText: string
  /** Background bubbles: rgb triplets + peak alphas. */
  bubbleCool: string
  bubbleWarm: string
  bubbleCoolAlpha: number
  bubbleWarmAlpha: number
}

const DARK_SHARED = {
  mode: 'dark' as const,
}
const LIGHT_SHARED = {
  mode: 'light' as const,
}

export const THEMES: Theme[] = [
  {
    ...DARK_SHARED,
    id: 'emberlight',
    name: 'Emberlight',
    bg: '#1d2434',
    text: '#f1f3f7',
    textMuted: '#a9b2c6',
    accent: '#e9cf8f',
    accentSoft: 'rgba(242, 217, 140, 0.4)',
    ctaBg: '#f1f3f7',
    ctaText: '#232a3c',
    bubbleCool: '86, 126, 200',
    bubbleWarm: '232, 146, 66',
    bubbleCoolAlpha: 0.5,
    bubbleWarmAlpha: 0.55,
  },
  {
    ...DARK_SHARED,
    id: 'lagoon',
    name: 'Lagoon',
    bg: '#132a2c',
    text: '#eef6f4',
    textMuted: '#9fbcb6',
    accent: '#8fdcc4',
    accentSoft: 'rgba(150, 224, 205, 0.4)',
    ctaBg: '#eef6f4',
    ctaText: '#12302c',
    bubbleCool: '64, 186, 168',
    bubbleWarm: '240, 138, 112',
    bubbleCoolAlpha: 0.42,
    bubbleWarmAlpha: 0.42,
  },
  {
    ...DARK_SHARED,
    id: 'orchid',
    name: 'Orchid',
    bg: '#251f36',
    text: '#f4f0f7',
    textMuted: '#b4aac8',
    accent: '#e8a8d0',
    accentSoft: 'rgba(242, 166, 208, 0.4)',
    ctaBg: '#f4f0f7',
    ctaText: '#2b2340',
    bubbleCool: '116, 122, 226',
    bubbleWarm: '224, 118, 178',
    bubbleCoolAlpha: 0.44,
    bubbleWarmAlpha: 0.44,
  },
  {
    ...DARK_SHARED,
    id: 'citrus',
    name: 'Citrus',
    bg: '#2b2420',
    text: '#f6f2ec',
    textMuted: '#c2b4a6',
    accent: '#eec886',
    accentSoft: 'rgba(244, 208, 130, 0.4)',
    ctaBg: '#f6f2ec',
    ctaText: '#33291f',
    bubbleCool: '228, 118, 126',
    bubbleWarm: '238, 182, 70',
    bubbleCoolAlpha: 0.38,
    bubbleWarmAlpha: 0.5,
  },
  {
    ...DARK_SHARED,
    id: 'northsea',
    name: 'North Sea',
    bg: '#1c2c31',
    text: '#eff5f8',
    textMuted: '#a3b8c2',
    accent: '#9cc9e8',
    accentSoft: 'rgba(160, 208, 240, 0.4)',
    ctaBg: '#eff5f8',
    ctaText: '#1e3138',
    bubbleCool: '118, 188, 232',
    bubbleWarm: '242, 152, 122',
    bubbleCoolAlpha: 0.44,
    bubbleWarmAlpha: 0.4,
  },
  {
    ...LIGHT_SHARED,
    id: 'goldenhour',
    name: 'Golden Hour',
    bg: '#f4efe4',
    text: '#3c352a',
    textMuted: '#8a7f6c',
    accent: '#a4712c',
    accentSoft: 'rgba(236, 196, 110, 0.55)',
    ctaBg: '#3c352a',
    ctaText: '#ffffff',
    bubbleCool: '120, 158, 214',
    bubbleWarm: '214, 160, 58',
    bubbleCoolAlpha: 0.45,
    bubbleWarmAlpha: 0.5,
  },
  {
    ...LIGHT_SHARED,
    id: 'seaglass',
    name: 'Sea Glass',
    bg: '#eef4ef',
    text: '#2c453e',
    textMuted: '#6f8680',
    accent: '#2f7d68',
    accentSoft: 'rgba(132, 212, 192, 0.55)',
    ctaBg: '#2c453e',
    ctaText: '#ffffff',
    bubbleCool: '58, 182, 158',
    bubbleWarm: '224, 194, 82',
    bubbleCoolAlpha: 0.42,
    bubbleWarmAlpha: 0.4,
  },
  {
    ...LIGHT_SHARED,
    id: 'peony',
    name: 'Peony',
    bg: '#f7eef3',
    text: '#46323e',
    textMuted: '#8f7a86',
    accent: '#a04a76',
    accentSoft: 'rgba(246, 172, 204, 0.55)',
    ctaBg: '#46323e',
    ctaText: '#ffffff',
    bubbleCool: '146, 152, 228',
    bubbleWarm: '236, 128, 172',
    bubbleCoolAlpha: 0.4,
    bubbleWarmAlpha: 0.4,
  },
  {
    ...LIGHT_SHARED,
    id: 'meadow',
    name: 'Meadow',
    bg: '#f2f4ea',
    text: '#39452f',
    textMuted: '#7d8871',
    accent: '#5c7f3c',
    accentSoft: 'rgba(188, 224, 160, 0.55)',
    ctaBg: '#39452f',
    ctaText: '#ffffff',
    bubbleCool: '142, 198, 108',
    bubbleWarm: '240, 172, 108',
    bubbleCoolAlpha: 0.42,
    bubbleWarmAlpha: 0.42,
  },
  {
    ...LIGHT_SHARED,
    id: 'lilacdawn',
    name: 'Lilac Dawn',
    bg: '#f1eef7',
    text: '#3c3452',
    textMuted: '#837b96',
    accent: '#6a55a8',
    accentSoft: 'rgba(196, 184, 240, 0.55)',
    ctaBg: '#3c3452',
    ctaText: '#ffffff',
    bubbleCool: '152, 132, 222',
    bubbleWarm: '224, 152, 140',
    bubbleCoolAlpha: 0.42,
    bubbleWarmAlpha: 0.38,
  },
]

export const DEFAULT_DARK_THEME_ID = 'emberlight'
export const DEFAULT_LIGHT_THEME_ID = 'goldenhour'

export function themesForMode(mode: ThemeMode): Theme[] {
  return THEMES.filter((t) => t.mode === mode)
}

export function getTheme(id: string): Theme | null {
  return THEMES.find((t) => t.id === id) ?? null
}

/** Write the theme's values into CSS custom properties on <html>. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.mode = theme.mode
  const dark = theme.mode === 'dark'
  const vars: Record<string, string> = {
    '--color-bg': theme.bg,
    '--color-text': theme.text,
    '--color-text-muted': theme.textMuted,
    '--color-accent': theme.accent,
    '--color-accent-soft': theme.accentSoft,
    '--color-cta-bg': theme.ctaBg,
    '--color-cta-text': theme.ctaText,
    '--color-surface': dark
      ? 'rgba(255, 255, 255, 0.10)'
      : 'rgba(255, 255, 255, 0.55)',
    '--color-surface-2': dark
      ? 'rgba(255, 255, 255, 0.16)'
      : 'rgba(255, 255, 255, 0.9)',
    '--color-border': dark
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(255, 255, 255, 0.85)',
    '--color-danger': dark ? '#f2a6a0' : '#b23f3a',
    '--color-danger-ink': dark ? '#33120f' : '#ffffff',
    '--color-success': dark ? '#9fd8b4' : '#2e7d4f',
    '--bubble-cool': theme.bubbleCool,
    '--bubble-warm': theme.bubbleWarm,
    '--bubble-cool-a': String(theme.bubbleCoolAlpha),
    '--bubble-warm-a': String(theme.bubbleWarmAlpha),
    '--hatch-line': dark
      ? 'rgba(10, 12, 22, 0.30)'
      : 'rgba(255, 255, 255, 0.5)',
    '--shadow-card': dark
      ? '0 14px 38px rgba(10, 12, 22, 0.35)'
      : '0 12px 34px rgba(59, 58, 71, 0.10)',
  }
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
}
