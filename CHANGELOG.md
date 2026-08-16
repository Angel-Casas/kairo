# Changelog

Notable changes per slice. Dates are completion dates.

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
