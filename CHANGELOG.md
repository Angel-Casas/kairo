# Changelog

Notable changes per slice. Dates are completion dates.

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
