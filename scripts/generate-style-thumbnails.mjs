#!/usr/bin/env node
/**
 * One-time generation of style preset thumbnails (ADR-008).
 *
 * Every thumbnail uses the SAME reference subject so users compare styles,
 * not pictures. Total cost is roughly $0.01 × number of styles, charged to
 * the key you provide. Existing thumbnails are skipped, so re-running only
 * generates what is missing.
 *
 * Usage:
 *   NANOGPT_API_KEY=your-key node scripts/generate-style-thumbnails.mjs
 *
 * Options via env:
 *   THUMB_MODEL       image model id (default: 'hidream')
 *   THUMB_RESOLUTION  resolution (default: '1024x1024')
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'styles')
const API = 'https://nano-gpt.com/api'

const KEY = process.env.NANOGPT_API_KEY
if (!KEY) {
  console.error('Set NANOGPT_API_KEY. Nothing was generated.')
  process.exit(1)
}
const MODEL = process.env.THUMB_MODEL ?? 'hidream'
const RESOLUTION = process.env.THUMB_RESOLUTION ?? '1024x1024'

// Keep these in sync with src/domain/stylePresets.ts (single source of truth
// lives there; this script re-reads it to avoid drift).
const presetsSource = await import('../src/domain/stylePresets.ts').catch(
  () => null,
)
let presets
if (presetsSource) {
  presets = presetsSource.STYLE_PRESETS
} else {
  // Node can't import .ts directly on older versions — fall back to a naive
  // parse of the file.
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(
    join(ROOT, 'src', 'domain', 'stylePresets.ts'),
    'utf8',
  )
  const ids = [...src.matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1])
  const fragments = [...src.matchAll(/promptFragment:\s*\n?\s*'([^']+)'/g)].map(
    (m) => m[1],
  )
  presets = ids.map((id, i) => ({
    id,
    promptFragment: fragments[i],
    thumbnail: `/styles/${id}.webp`,
  }))
}

const SUBJECT =
  'a lighthouse on a rocky cliff at sunset, waves below, seabirds in the sky'

await mkdir(OUT_DIR, { recursive: true })

let generated = 0
for (const preset of presets) {
  const outPath = join(OUT_DIR, `${preset.id}.webp`)
  const exists = await access(outPath).then(
    () => true,
    () => false,
  )
  if (exists) {
    console.log(`skip   ${preset.id} (already exists)`)
    continue
  }
  console.log(`gen    ${preset.id} …`)
  const response = await fetch(`${API}/v1/images`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${preset.promptFragment}. ${SUBJECT}`,
      resolution: RESOLUTION,
      n: 1,
    }),
  })
  if (!response.ok) {
    console.error(`FAIL   ${preset.id}: HTTP ${response.status}`)
    continue
  }
  const data = await response.json()
  const img = data.data?.[0]
  let bytes
  if (img?.b64_json) {
    bytes = Buffer.from(img.b64_json, 'base64')
  } else if (img?.url) {
    const imgResponse = await fetch(img.url)
    bytes = Buffer.from(await imgResponse.arrayBuffer())
  } else {
    console.error(`FAIL   ${preset.id}: no image in response`)
    continue
  }
  // Note: saved as-is; if the model returns png/jpg the browser still renders
  // it fine despite the .webp name, but you can convert with sharp/squoosh
  // for smaller files before committing.
  await writeFile(outPath, bytes)
  generated += 1
  console.log(`done   ${preset.id} (${bytes.length} bytes)`)
}

console.log(
  `\nFinished: ${generated} generated, output in public/styles/. ` +
    'Review them, optionally convert/optimize to webp, then commit.',
)
