# Changelog

Notable changes per slice. Dates are completion dates.

## Slice 12 — Style-from-image (2026-08-21)

- "Describe a style from an image" on the Scenes stage: pick a local image
  (png/jpeg/webp validated; it goes only to NanoGPT, as a base64 data URL),
  pick a vision-capable model, and get palette / lighting / medium /
  composition as prompt-ready style notes — style only, the subject is
  explicitly banned from the output so scene content never leaks into every
  image prompt.
- Result lands as an editable proposal; applying it replaces the style notes
  behind a confirmation when notes already exist. Nothing is overwritten
  silently.
- Client: `ChatMessage` widened to OpenAI-style content parts (text +
  image_url, docs-verified format); `TextModel.supportsVision` parsed from
  `capabilities.vision`; the text-model picker gained an `onlyVision` filter.
- Cost honesty per LESSONS: the text side is estimated and enforced with a
  150-token max_tokens ceiling ("up to ~"), the label says the image input
  adds a model-dependent amount, and the full actual cost is recorded from
  usage in the cost log ("Style from image").
- Tests: 170 unit, 24 e2e (multimodal request body, vision filter, budget
  enforcement, confirm-before-replace, reload persistence).

## Slice 11 — Generation history viewer (2026-08-21)

- Expandable "History (N)" on every asset: scene images, clips, and reference
  images — one reusable `GenerationHistory` component. Each version shows the
  exact prompt sent, model, actual cost, date, and an active marker; imported
  reference versions are labeled honestly (imported file, free, no prompt).
- Copy prompt with clipboard feedback on every stored prompt.
- Edit & regenerate for images: the stored prompt prefilled in an editor and
  sent VERBATIM (new `promptOverride` on `generateSceneImage` and
  `generateReferenceImage` — no recomposition of style/references), through
  the normal job + cost-log machinery with upfront price. Reference image
  attachment still follows scene ticks and model capability.
- Clips are view/copy only; motion-prompt editing deferred to Slice 11.1 so
  the expensive generation kind gets the full confirmation treatment.
- Tests: 165 unit (component + override paths), 22 e2e (history contents,
  verbatim regeneration asserted on the request body, clipboard).

## Slice 10 — References (2026-08-21)

- One concept for cross-scene subject consistency (ADR-009), merging the
  planned "asset passports" with Angel's reference-image idea: project-level
  References (character / location / art style) with a name, an exhaustive
  descriptor, and an optional reference image.
- Part A — descriptors: References panel on the Scenes stage; per-scene
  tick-boxes; ticked descriptors injected VERBATIM into those scenes' image
  prompts (between style notes and the scene description — never shortened;
  variants are separate references). Deleting a reference confirms and unticks
  it everywhere.
- Part B — reference images: import from disk (free, validated, straight into
  OPFS) or generate in-app from the descriptor (normal job + cost log,
  "Reference image" entries, append-only versions with active switching,
  project style composed in). At scene generation, active images of ticked
  references are attached via the API's `input_references` array
  (docs-verified; never mixed with legacy image aliases).
- Honest capability handling: image model picker labels i2i-capable models
  ("accepts reference images") with an opt-in filter; a non-capable model
  states that images will be skipped while descriptions still apply.
- Schema stays v1: `Project.references` + `Scene.referenceIds` are additive
  with `normalizeProject` backfill; `.kairo` import re-roots reference blobs.
- Fixed a pre-existing e2e race (new LESSONS rule): "survives reload" tests
  now poll IndexedDB for the persisted value before reloading instead of
  trusting optimistic UI state.
- Tests: 154 unit, 21 e2e (including a request-body assertion that
  `input_references` is actually sent, and skip behavior for non-i2i models).

## Slice 9 — Prompt-quality upgrade (2026-08-16)

- Craft rules from a production pipeline (critically filtered from an
  external article) baked into every default prompt:
  - Scene breakdown: exactly one action per scene, never a sequence; visual
    descriptions may not rely on readable text/signs/screens.
  - Image prompts: "no readable text, signs, or lettering in the image."
  - Video motion prompts: one continuous action with the camera drifting
    along with it — no frozen figures (a camera move past a static figure
    reads as a drifting still) — and explicit style/palette preservation.
- Roadmap re-planned per Angel: asset passports, generation history viewer,
  and style-from-image land before the design pass.

## Slice 8 — Hardening (2026-08-16) — FUNCTION-COMPLETE

- Offline: app shell loads with no network (service worker precache, verified
  by e2e); header indicator explains that generation needs a connection while
  local work stays available.
- Crash safety: React error boundary shows a recovery screen instead of a
  white page — all state is in IndexedDB/OPFS, so reload always recovers.
- Account usage in Settings: requests + net spend for the current key, on
  demand, completing per-generation → per-project → per-account cost
  visibility.
- A11y basics: visible :focus-visible outlines, ConfirmDialog focuses Cancel
  on open and cancels on Escape, aria-modal announced.
- Tests: 130 unit, 18 e2e (incl. offline reload).

## Slice 7 — Export stage (2026-08-16)

- Clips zip: scene clips numbered in order plus script.txt, built straight
  from OPFS with fflate; works for incomplete projects and says which scenes
  are missing.
- Stitched draft MP4: ffmpeg.wasm loaded lazily from CDN on first use
  (~31 MB, never on normal loads), stream-copy concatenation with a clear
  error path for mixed-codec projects.
- Project backup: .kairo download on the Export stage and an Import button on
  the project list — completing the Slice 1 export/import functions with UI.
- Export stage unlocks at the first finished clip.
- Tests: 125 unit, 17 e2e including download content verification and a full
  backup export→import round trip.

## Slice 6.1 — Video cost transparency (2026-08-16, from Angel's real-usage feedback)

- Video model picker now shows each model's price range parsed from NanoGPT's
  pricing data ("≈$0.72–$1.80 per clip (depends on settings)"); models without
  listed pricing say so explicitly. Trigger: $1.80/clip surprised a $5 budget.
- Resolution is now user-controlled and **defaults to the cheapest tier** —
  previously Kairo sent no resolution and the provider silently picked its
  default (the likely cause of $1.80 charges vs. the $0.72 listed price).
- Every video submission (single and animate-all) now requires an explicit
  confirmation stating model, resolution, duration, and the price picture
  before money moves.
- New LESSONS rule: the more a generation kind can cost, the stronger its
  cost UX must be — surface pricing, expose cost-driving parameters defaulted
  cheap, and confirm before any submission that can exceed ~$0.50.

## Slice 6 — Animation stage (2026-08-16)

- Image-to-video per scene: the active image is sent as a data URL with a
  motion prompt derived from the visual description, 9:16, selectable
  duration. NanoGPT charges at submission — Kairo logs the exact amount then,
  not later.
- Background polling of the unified status endpoint (10s; tolerates transient
  network errors, fails the job after 10 consecutive); completed clips are
  downloaded straight into OPFS as append-only versions with inline players
  and version switching; failures show the provider error and are retryable.
- Resumable by design: jobs persist runId, prompt, and submitted cost
  (additive fields + normalizeJob backfill); reopening a project resumes
  polling for interrupted jobs and collects finished clips; jobs interrupted
  before submission are failed cleanly (no charge, no orphan).
- Animate-all for scenes with an image and no clip; video model picker
  filtered to image-to-video capable models.
- Tests: 116 unit (incl. interrupt/resume, submission-rejected, provider-
  failed paths), 14 e2e (incl. reload-mid-generation resume).

## Maintenance — refactor/review session (2026-08-16)

- Extracted `src/state/generationJob.ts` (`withGenerationJob`): the persisted
  queued → submitted → succeeded/failed lifecycle, previously duplicated in
  script, scene-breakdown, and image generation, now lives in one place —
  Slice 6's video generation will build on it too.
- Moved `buildStages` into `src/domain/stages.ts`; lint warnings down to zero.
- Deduplicated e2e setup into `e2e/helpers.ts` (shared NanoGPT mocks, key
  onboarding, project creation).
- Dependency audit: everything current except TypeScript 7 and @types/node 26
  majors, deliberately deferred. LESSONS.md rules audited against the code —
  all compliant. No behavior changes; full suite stayed green throughout.

## Slice 5 — Image stage (2026-08-16)

- Style preset gallery (ADR-008): 16 curated artistic styles with prompt
  fragments; thumbnail cards (name-tiles until pregenerated thumbnails are
  committed); `scripts/generate-style-thumbnails.mjs` generates them once with
  the same reference subject.
- Per-scene image generation: image-model picker with per-image pricing,
  automatic portrait resolution for 9:16 (handles x/* separator drift in
  NanoGPT pricing keys), exact cost before every generation.
- Results stored immediately in OPFS as append-only versions — regeneration
  never destroys a paid image; active-version switching per scene.
- Generate-all-missing with upfront total cost and progress display.
- Prompt composition: style preset fragment + project style notes + scene
  visual description + 9:16 framing hint.
- Tests: 110 unit, 11 e2e (image results mocked with a real tiny PNG).

## Slice 4 — Scene breakdown stage (2026-08-16)

- Scenes stage, unlocked by locking the script; stage availability is now
  state-driven with hints on disabled stages.
- AI breakdown: locked script → 5-10 scenes as JSON, parsed defensively
  (fences/prose tolerated, malformed output rejected with a clear error),
  replace-confirmation, enforced 800-token budget, job + cost log with actuals.
- Scene editing: cards with script excerpt + visual description (autosaved),
  add/remove/reorder with automatic renumbering.
- Project-level visual style notes (persisted; feeds image prompts in Slice 5).
- ADR-008 recorded: style preset gallery with pregenerated same-subject
  thumbnails (Angel's idea); `stylePresetId` domain field added now,
  `normalizeProject` backfills older stored projects.
- Tests: 93 unit, 9 e2e.

## Slice 3.2 — Visible project spend (2026-08-16, from Angel's feedback)

- New `CostSummary` in the project view: total spend (actuals preferred,
  estimates as fallback) with an expandable per-generation breakdown showing
  estimate vs. actual side by side. Previously actuals were recorded but not
  displayed anywhere before Slice 8.

## Slice 3.1 — Cost accuracy fixes (2026-08-16, from Angel's real-usage feedback)

- Script output budget lowered 1000 → 300 tokens and now actually enforced by
  sending `max_tokens`, so the estimate is a true ceiling (labeled "up to ~").
  Real request that prompted this: estimate ~$0.003 vs actual $0.000592.
- Actual costs now recorded: chat responses' token usage is parsed and priced
  (`computeActualChatCostUsd`), stored as `actualUsd` in the cost log.
- Model picker gained a filter box (NanoGPT lists hundreds of models); the
  selected model stays choosable even when filtered out.
- New LESSONS.md entry: estimates must be derived + enforced + validated
  against a real request; catalog-fed UIs must be tested at realistic sizes.

## Slice 3 — Script stage (2026-08-16)

- Pipeline shell: stage navigation (Script → Scenes → Images → Animation →
  Export) with Script live and later stages disabled.
- Script editor: debounced autosave to IndexedDB (+ flush on blur), character
  count, lock/unlock with a downstream-impact confirmation.
- AI generation: reusable text-model picker with real per-MTok prices,
  estimated cost shown before generating (models without listed pricing show
  "cost unknown" — never a fake $0.00), overwrite guard for existing text.
- Generations run through persisted `GenerationJob`s (Slice 1 state machine)
  and append cost log entries — the project spend history starts here.
- Prompt templates live in `src/domain/prompts.ts` (model-facing, English).
- Wired the real repo URL into `src/config.ts`.
- Tests: 70 unit, 7 e2e (all NanoGPT endpoints mocked).

## Slice 2 — NanoGPT client & key management (2026-08-16)

- Typed `NanoGptClient` covering check-balance, model listings (text with
  per-MTok pricing, image with per-image pricing, video with capabilities),
  OpenAI-compatible chat completions, image generation, async video generation
  with unified status polling, and usage totals. Endpoint shapes verified
  against the NanoGPT docs; typed `NanoGptError`/`InvalidApiKeyError`; the API
  key is never logged or embedded in errors.
- Settings store: key persisted in localStorage, validated via check-balance
  before saving, masked display, revoked-key detection, balance refresh that
  tolerates network errors.
- UI: settings screen with onboarding for keyless users (referral link),
  balance in the header, "needs your key" banner on the project list.
- `src/config.ts`: single auditable constants file (base URL, referral URL).
- Tests: 57 unit (client + settings store, all HTTP mocked with MSW), 5 e2e
  (NanoGPT mocked via Playwright network routes).

## Slice 1 — Domain model & persistence (2026-08-16)

- Domain types: `Project`, `Scene`, `AssetVersion` (append-only versions),
  `GenerationJob`, append-only cost log.
- Job state machine (`queued → submitted → polling → succeeded | failed`,
  `failed → queued` retry) as pure, immutable functions; scene status derived
  from jobs + versions, never stored.
- Persistence: IndexedDB via `idb` (schema v1 with migration scaffold),
  `BlobStore` abstraction with OPFS + in-memory implementations, cascading
  project delete (project + jobs + blobs).
- `.kairo` project export/import (zip with project.json + asset blobs; imports
  get a fresh project id).
- `zustand` app store; bare project list UI with create, rename, and
  delete-behind-confirmation.
- Tests: 35 unit (state machine, derivation, repository on `fake-indexeddb`,
  export/import round-trips), 3 Playwright e2e including reload persistence.

## Slice 0 — Foundation (2026-08-16)

- Vite 8 + React 19 + strict TypeScript 6 PWA scaffold (vite-plugin-pwa,
  manifest, icons, auto-update service worker).
- Tooling: oxlint, Prettier, Vitest (jsdom), Playwright (e2e against the
  production preview build), GitHub Actions CI.
- AGPL-3.0 license; founding docs (CLAUDE.md, DECISIONS.md ADR-001..007,
  LESSONS.md, ROADMAP.md); minimal functional design tokens (ADR-007);
  `formatUsd` cost-formatting helpers.
