/**
 * Curated artistic style presets (ADR-008). One auditable file: what each
 * style is, the prompt fragment it contributes, and where its thumbnail
 * lives. Thumbnails are pregenerated once with the SAME reference subject
 * (see scripts/generate-style-thumbnails.mjs) so users compare styles, not
 * pictures. Missing thumbnails render as name-tiles in the UI.
 */

export interface StylePreset {
  id: string
  name: string
  /** Prepended to every image prompt when this preset is selected. */
  promptFragment: string
  /** Path under public/, e.g. /styles/watercolor.webp */
  thumbnail: string
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'watercolor',
    name: 'Watercolor',
    promptFragment:
      'delicate watercolor painting, soft washes of color, visible paper texture, gentle bleeding edges',
    thumbnail: '/styles/watercolor.webp',
  },
  {
    id: 'oil-painting',
    name: 'Oil painting',
    promptFragment:
      'classical oil painting, rich impasto brushstrokes, dramatic chiaroscuro lighting, museum quality',
    thumbnail: '/styles/oil-painting.webp',
  },
  {
    id: 'anime',
    name: 'Anime',
    promptFragment:
      'high-quality anime illustration, clean lineart, vibrant cel shading, expressive composition',
    thumbnail: '/styles/anime.webp',
  },
  {
    id: 'comic-ink',
    name: 'Comic ink',
    promptFragment:
      'bold comic book ink illustration, heavy black outlines, halftone shading, dynamic panels energy',
    thumbnail: '/styles/comic-ink.webp',
  },
  {
    id: 'pixel-art',
    name: 'Pixel art',
    promptFragment:
      'detailed pixel art, 32-bit era video game aesthetic, crisp dithering, limited color palette',
    thumbnail: '/styles/pixel-art.webp',
  },
  {
    id: 'claymation',
    name: 'Claymation',
    // Enriched in 20.3 from Angel's reference: the charm lives in the
    // handmade evidence (fingerprints, tool marks) and the warm
    // practical-light miniature-set photography around it.
    promptFragment:
      'claymation stop-motion film still, hand-molded plasticine characters with visible fingerprints and tool marks, handcrafted miniature set, warm practical lighting with string-bulb bokeh, shallow depth of field, tactile handmade charm',
    thumbnail: '/styles/claymation.webp',
  },
  {
    id: 'felted-wool',
    name: 'Felted wool',
    promptFragment:
      'needle-felted wool miniature, fuzzy fiber texture, soft rounded handmade characters, warm cozy lighting, shallow depth of field, tactile craft charm',
    thumbnail: '/styles/felted-wool.webp',
  },
  {
    id: '3d-render',
    name: '3D render',
    promptFragment:
      'polished 3D render, physically based materials, soft global illumination, cinematic depth of field',
    thumbnail: '/styles/3d-render.webp',
  },
  {
    id: 'photorealistic',
    name: 'Photorealistic',
    promptFragment:
      'photorealistic photograph, natural lighting, sharp focus, high dynamic range, 35mm',
    thumbnail: '/styles/photorealistic.webp',
  },
  {
    id: 'cinematic',
    name: 'Cinematic still',
    promptFragment:
      'cinematic film still, anamorphic framing, moody color grading, dramatic key light, shallow depth of field',
    thumbnail: '/styles/cinematic.webp',
  },
  {
    id: 'film-noir',
    name: 'Film noir',
    promptFragment:
      '1940s film noir photograph, hard black-and-white contrast, venetian-blind shadows, drifting cigarette smoke and rain-slick streets, low-key dramatic lighting',
    thumbnail: '/styles/film-noir.webp',
  },
  {
    id: 'low-poly',
    name: 'Low poly',
    promptFragment:
      'low-poly 3D art, faceted geometric surfaces, flat shading, minimalist color blocking',
    thumbnail: '/styles/low-poly.webp',
  },
  {
    id: 'papercraft',
    name: 'Papercraft',
    promptFragment:
      'layered papercraft diorama, cut paper collage, subtle drop shadows between layers, handcrafted feel',
    thumbnail: '/styles/papercraft.webp',
  },
  {
    id: 'charcoal',
    name: 'Charcoal sketch',
    promptFragment:
      'expressive charcoal sketch, rough gestural strokes, smudged shading, textured paper grain, monochrome',
    thumbnail: '/styles/charcoal.webp',
  },
  {
    id: 'ukiyo-e',
    name: 'Ukiyo-e',
    promptFragment:
      'traditional Japanese ukiyo-e woodblock print, flat color planes, elegant linework, visible washi texture',
    thumbnail: '/styles/ukiyo-e.webp',
  },
  {
    id: 'stained-glass',
    name: 'Stained glass',
    promptFragment:
      'luminous stained glass window panel, jewel-toned glass segments, bold black leading outlines, light glowing through translucent color, cathedral mosaic composition',
    thumbnail: '/styles/stained-glass.webp',
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    promptFragment:
      'synthwave retrofuturism, neon magenta and cyan glow, gridlines and haze, 1980s sci-fi poster',
    thumbnail: '/styles/synthwave.webp',
  },
  {
    id: 'vintage-poster',
    name: 'Vintage poster',
    promptFragment:
      'mid-century travel poster gouache, flat confident shapes, limited retro palette, subtle screen-print grain, elegant simplified forms',
    thumbnail: '/styles/vintage-poster.webp',
  },
  {
    id: 'storybook',
    name: 'Storybook',
    promptFragment:
      "children's storybook illustration, warm cozy palette, soft rounded shapes, whimsical hand-drawn charm",
    thumbnail: '/styles/storybook.webp',
  },
  {
    id: 'isometric',
    name: 'Isometric',
    promptFragment:
      'isometric illustration, precise 30-degree perspective, clean vector-like shapes, miniature world feel',
    thumbnail: '/styles/isometric.webp',
  },
]

export function getStylePreset(id: string | null): StylePreset | null {
  if (id === null) return null
  return STYLE_PRESETS.find((s) => s.id === id) ?? null
}

/** Reference subject used for ALL pregenerated thumbnails (ADR-008). */
export const THUMBNAIL_REFERENCE_SUBJECT =
  'a lighthouse on a rocky cliff at sunset, waves below, seabirds in the sky'
