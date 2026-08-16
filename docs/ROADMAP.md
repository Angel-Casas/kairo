# ROADMAP.md — Kairo v1

Each slice is a small, working, end-to-end increment. The cycle for every slice:
**plan → Angel approves → implement → tests green → screenshot self-review →
Angel reviews → update docs → done.** Slices are ordered; don't skip ahead.

Status marks: `[ ]` not started · `[~]` in progress · `[x]` done

## V1 slices (shorts only — ADR-003)

- [x] **Slice 0 — Foundation.** _(done 2026-08-16)_ Vite 8 + React 19 + strict
      TypeScript 6 scaffold; vite-plugin-pwa (manifest + icons + auto-update SW);
      oxlint + Prettier; Vitest (8 unit tests) ; Playwright e2e against the
      production preview build (2 smoke tests); AGPL-3.0 LICENSE; GitHub Actions CI
      (lint, format check, tests, build, e2e); minimal functional tokens in
      `src/index.css` (full design deferred — ADR-007); `formatUsd` cost-formatting
      helpers. Commands filled into CLAUDE.md. _Still to do by Angel: create the
      GitHub repo and push._

- [x] **Slice 1 — Domain model & persistence.** _(done 2026-08-16)_ Domain types
      (`Project`/`Scene`/`AssetVersion`/`GenerationJob` + append-only cost log);
      job state machine as pure functions (`queued → submitted → polling →
succeeded | failed`, retry) with scene status _derived_ from jobs+versions;
      IndexedDB via `idb` (migration scaffold, v1) + `BlobStore` interface (OPFS
      impl + in-memory for tests/fallback); `.kairo` project export/import (zip
      via `fflate`, new-id-on-import, round-trip tested); `zustand` app store;
      bare project list UI (create/rename/delete-with-confirm). 35 unit tests +
      3 e2e (incl. reload persistence).

- [x] **Slice 2 — NanoGPT client & key management.** _(done 2026-08-16)_ Typed
      `NanoGptClient` (check-balance, text/image/video model listings with
      pricing, chat completions, image gen, async video gen + unified status
      polling, usage) with endpoint shapes verified against the docs; typed
      errors, key never logged/leaked; MSW-mocked unit tests for every method;
      settings store (key in localStorage, validate-on-save via check-balance,
      revoked-key detection); settings UI with masked key, balance display in
      header + refresh, referral onboarding link for keyless users (ADR-005 —
      real link wired: nano-gpt.com/r/BnfJfghE). 57 unit tests + 5 e2e (network
      mocked via Playwright routes). _Note: `REPO_URL` in src/config.ts still a
      placeholder — set it to the real GitHub repo URL._

- [x] **Slice 3 — Script stage.** _(done 2026-08-16)_ Pipeline shell
      (`StagesNav`, Script active, later stages visible-but-disabled); script
      editor with debounced autosave + flush-on-blur, lock/unlock with
      downstream warning; reusable `TextModelPicker` showing per-MTok prices;
      generate panel with **upfront cost estimate** (`estimateChatCostUsd` —
      unknown pricing shows "unknown", never $0.00), overwrite confirmation,
      generation through a persisted `GenerationJob` + cost log entry; prompts
      in `src/domain/prompts.ts`; repo singleton extracted to
      `src/state/repo.ts`; real `REPO_URL` wired. 70 unit tests + 7 e2e.

- [x] **Slice 4 — Scene breakdown stage.** _(done 2026-08-16)_ Scenes stage
      gated on locked script (state-driven `buildStages`); AI breakdown to JSON
      parsed defensively (`parseSceneBreakdown`, heavily unit-tested), replace
      confirm, upfront "up to ~$" estimate with enforced 800-token budget, job +
      cost log with actuals; editable scene cards (excerpt + visual description,
      autosaved), add/remove/reorder with order renumbering; project style notes
      persisted; `stylePresetId` field added ahead of ADR-008's Slice 5 picker;
      `normalizeProject` fills defaults for older stored projects. 93 unit
      tests + 9 e2e.

- [x] **Slice 5 — Image stage.** _(done 2026-08-16)_ Style preset gallery
      (ADR-008): 16 curated presets in `src/domain/stylePresets.ts`, selectable
      cards that degrade to name-tiles until thumbnails exist,
      `scripts/generate-style-thumbnails.mjs` for Angel to pregenerate them
      (~$0.20 one-time). Per-scene image generation: filterable image-model
      picker with per-image prices, portrait-resolution auto-pick for 9:16
      (`pickPortraitResolution`, x/* separator drift handled), exact cost shown
      before every click, results (b64 or URL) downloaded straight into OPFS as
      append-only `AssetVersion`s with active-version switching, jobs + cost log
      actuals, generate-all-missing with total cost + progress. 110 unit tests + 11 e2e. _Angel: run the thumbnail script and commit public/styles/._

- [ ] **Slice 6 — Animation stage.** Image-to-video per scene; async job handling
      with polling via the unified video status endpoint; **resumable across tab
      close** (the hardest requirement in the app — plan this slice carefully); failed
      jobs surface clearly and are retryable.

- [ ] **Slice 7 — Export.** Zip of numbered clips + script text file; optional
      stitched draft MP4 via ffmpeg.wasm (ADR-004); export works for incomplete
      projects (whatever is ready gets exported).

- [ ] **Slice 8 — Hardening.** PWA installability + offline app shell; empty/
      error/loading states pass; project cost dashboard (usage endpoint); a11y
      basics. Function-complete checkpoint — everything works end to end.

- [ ] **Slice 9 — Design pass (ADR-007).** The dedicated aesthetics slice, done
      last: visual identity, real token values, component styling sweep, layout
      refinement, motion where it earns its keep. This is where "looks good"
      happens — not before.

- [ ] **Slice 10 — i18n & ship (ADR-007).** Extract strings, add target
      languages; README with screenshots; deploy to GitHub Pages; skim NanoGPT ToS
      re: third-party apps and affiliate usage before announcing.

## V2 backlog (not now — resist scope creep)

Long-form videos (multi-minute, many scenes); audio: voiceover/TTS and music via
NanoGPT audio models; caption/subtitle generation; character & style consistency
tooling (reference images across scenes); prompt/style template library; project
sync across devices; community template sharing.

## Recurring maintenance

Every ~4 slices: a dedicated refactor/review session — no new features, just code
health, dependency updates, and a LESSONS.md review. Keep a CHANGELOG.md from
Slice 0 onward.
