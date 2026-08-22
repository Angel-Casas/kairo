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

- [x] **Slice 6 — Animation stage.** _(done 2026-08-16)_ Image-to-video per
      scene: active image → data URL → `/generate-video` (9:16, duration
      picker), actual cost captured at submission and logged immediately;
      polling via the unified status endpoint (10s interval, transient-error
      tolerance, 10-strike failure cap); completed clips downloaded into OPFS
      as append-only versions with switching + inline players; **resume after
      tab close** via jobs persisted with runId/prompt/cost (additive fields +
      `normalizeJob`), `resumeVideoJobs` on project load, never-submitted jobs
      failed cleanly; animate-all; honest "charged at submission" cost message
      where no upfront price exists; `VideoModelPicker` filtered to
      image-to-video models. 116 unit tests + 14 e2e (incl. reload-resume).

- [x] **Slice 7 — Export.** _(done 2026-08-16)_ Export stage gated on first
      clip: clips zip (`scene-01.mp4`… + `script.txt`, extension from mime,
      works for incomplete projects with missing-scene summary); stitched
      draft MP4 via lazily-loaded ffmpeg.wasm (~31 MB CDN core on first use,
      stream-copy concat with clear mixed-codec error); `.kairo` project
      backup button + import button on the project list (finishing Slice 1's
      round-trip functions). 125 unit tests + 17 e2e (incl. real download
      verification and a backup export→import round trip). _Stitched draft is
      manual-test only — Angel: try it on a real project._

- [x] **Slice 8 — Hardening.** _(done 2026-08-16)_ Offline app shell verified
      by an e2e that cuts the network and reloads (service worker precache);
      header offline indicator; React error boundary (crash → recovery screen,
      data safe in IndexedDB/OPFS); account usage section in Settings
      (requests + net spend via the usage endpoint, completing the money
      story: per-generation → per-project → per-account); a11y basics:
      `:focus-visible` outlines, dialog focus-on-open + Escape-to-cancel.
      130 unit tests + 18 e2e. **FUNCTION-COMPLETE — the whole pipeline works
      end to end.** Remaining slices are polish and reach.

### Post-function-complete features (from Angel's direction, 2026-08-16 —

### several ideas critically filtered from an external pipeline article)

- [x] **Slice 9 — Prompt-quality upgrade.** _(done 2026-08-16)_ Craft rules
      baked into default prompts: scene breakdown enforces exactly one action
      per scene and bans reliance on in-frame text; image prompts append a
      no-text rule; video motion prompts pair the camera with one continuous
      action ("no frozen figures") and preserve style/palette.

- [x] **Slice 10 — References (asset passports + reference images, ADR-009).**
      _(done 2026-08-21, redefined per Angel's idea)_ Cross-scene SUBJECT
      consistency (the "model has no memory" problem), in two parts.
      **Part A:** project-level References (character/location/art style) with
      name + exhaustive descriptor; scenes tick the references they use;
      ticked descriptors injected VERBATIM into those scenes' image prompts
      (never shortened; variants are separate references). **Part B:** each
      reference optionally holds an image — imported from disk (free) or
      generated in-app from its descriptor (normal job + cost log, append-only
      versions with active switching); at scene generation the active images
      of ticked references are attached via the API's `input_references`
      (verified against NanoGPT docs; never mixed with legacy image aliases).
      Model capability handled honestly: i2i-capable models labeled and
      filterable in the picker, non-capable models say the images will be
      skipped while descriptors still apply. All fields additive with
      `normalizeProject` backfill; `.kairo` import re-roots reference blobs.
      175 unit + e2e tests total (154 unit, 21 e2e incl. request-body
      assertion of `input_references`).

- [x] **Slice 11 — Generation history viewer.** _(done 2026-08-21)_ Every
      version's exact prompt, model, actual cost, and date surfaced in a
      reusable expandable History list on the Images stage, the Animation
      stage, and reference cards (Slice 10). Copy-prompt everywhere; images
      additionally get "Edit & regenerate": the stored prompt prefilled,
      edited text sent VERBATIM (no recomposition — `promptOverride` on
      `generateSceneImage`/`generateReferenceImage`) through the normal job +
      cost-log path; reference image attachment still follows scene ticks.
      Imported versions honestly labeled ("imported file", free, no prompt).
      Clips are view/copy only in this slice — motion-prompt editing deferred
      to Slice 11.1 (expensive kind ⇒ needs the full cost-confirmation
      treatment). 165 unit + 22 e2e.

- [x] **Slice 11.1 — Clip motion-prompt editing.** _(done 2026-08-21)_
      Edit & regenerate on clip history versions: the stored motion prompt
      prefilled, edited text sent VERBATIM (`promptOverride` on
      `generateSceneVideo`), and — because clips are the expensive kind —
      the generate button opens the Slice 6.1 confirmation dialog (model,
      resolution, duration, price picture) before any submission; the history
      row itself says the price is confirmed before money moves. 172 unit +
      25 e2e (dialog-gating and verbatim body asserted).

- [x] **Slice 12 — Style-from-image.** _(done 2026-08-21)_ "Describe a style
      from an image" on the Scenes stage: local image (png/jpeg/webp,
      validated; sent only to NanoGPT as a base64 data URL per the
      docs-verified multimodal chat format) + vision-filtered text-model
      picker (`capabilities.vision` parsed into `TextModel.supportsVision`).
      The model names palette, light, medium, and composition — style only,
      subject banned — into an editable proposal applied to style notes with
      replace-confirmation. Cost honesty: text side estimated and enforced
      (150-token `max_tokens`), image input labeled as model-dependent extra,
      actuals recorded from usage ("Style from image" cost-log entries).
      `ChatMessage` widened to OpenAI content parts. 170 unit + 24 e2e.
      _Angel: validate the estimate against one real request with a cheap
      vision model (LESSONS rule)._

- [x] **Slice 13 — Design pass (ADR-010).** _(done 2026-08-21)_ The visual
      identity, set in stone after several canvas rounds with Angel: blended
      color-bubble backdrop + diagonal hatch over a solid ground, glass
      panels, pill controls, Instrument Sans. Ten palettes (5 dark / 5 light)
      in `src/domain/themes.ts`, applied as CSS custom properties by
      `applyTheme()`; top navbar with Kairo left, balance + project spend
      centered (hidden on small screens), palette dropdown + light/dark
      toggle + Settings right (space reserved for the Slice 14 language
      dropdown). Mode and per-mode palette persist in localStorage and follow
      `prefers-color-scheme` by default. Component sweep: `.card` glass
      panels, `.primary` CTAs, pill stage nav. 182 unit + 28 e2e.
      _Animations/transitions deliberately deferred to the next job — the
      whole UI should move, and the backdrop was built static-first for it._
      _13.1 follow-up (same day): the light/dark toggle merged into a single
      all-palettes swatch dropdown (picking a palette picks its mode), and
      settings became a fullscreen overlay with a gear→X navbar button._

- [x] **Slice 14 — Filmstrip workflow (ADR-011).** _(done 2026-08-21)_ The
      chosen redesign of the workflow itself: transport-deck pipeline nav
      (film-leader scrubber + segmented rail with hand-drawn SVG state
      icons), the reel + workbench layout for Images and Animation, the
      poster-wall projects page, and the wide 96rem layout (Script keeps a
      reading column; Scenes and Export go to grids). Direction and every
      nav detail picked by Angel across four design-canvas rounds. 184 unit + 30 e2e. _Animations still deliberately deferred — next job._

- [x] **Slice 15 — Audio stage (ADR-012).** _(done 2026-08-22)_ Per-scene TTS
      narration between Scenes and Images (skippable — Images never waits):
      curated NanoGPT TTS catalog (no listing endpoint exists), character-based
      **exact** pricing shown before every click, append-only audio takes in
      OPFS with history + edit-and-regenerate, batch narrate, narration
      players + duration hints in Animation, `narration-NN.mp3` in the clips
      zip. 188 unit + 33 e2e. _Moved up from the V2 backlog at Angel's
      request._

- [ ] **Slice 16 — i18n & ship (ADR-007).** Extract strings, add target
      languages; README with screenshots; deploy to GitHub Pages; skim NanoGPT ToS
      re: third-party apps and affiliate usage before announcing. _Before or
      with this: the promised animation/transition pass (deck playhead travel,
      rail transitions, reel frame selection, lightbox zoom, settings-overlay
      fade, bubble drift)._

## V2 backlog (not now — resist scope creep)

Long-form videos (multi-minute, many scenes); music via NanoGPT audio models;
caption/subtitle generation; per-voice TTS preview samples; prompt/style
template library; project sync across devices; community template sharing.
(Character & style consistency tooling moved up and shipped as Slice 10 —
References; voiceover/TTS moved up and shipped as Slice 15 — Audio.)

## Recurring maintenance

Every ~4 slices: a dedicated refactor/review session — no new features, just code
health, dependency updates, and a LESSONS.md review. Keep a CHANGELOG.md from
Slice 0 onward.

- 2026-08-16 (after Slice 5): extracted `withGenerationJob` (deduplicated job
  lifecycle across all three generators), moved `buildStages` to
  `src/domain/stages.ts` (lint warnings now zero), shared e2e fixtures in
  `e2e/helpers.ts`. Deps current except TypeScript 7 / @types/node 26 majors —
  deferred to a future maintenance pass. LESSONS rules audited: all compliant.
