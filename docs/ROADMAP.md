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

- [ ] **Slice 1 — Domain model & persistence.** `Project` / `Scene` / `AssetVersion`
      types; the scene state machine (`pending → generating → ready | failed`);
      IndexedDB (project docs) + OPFS (binaries) persistence layer; project
      export/import as a file. **Thorough unit tests — this is the most-tested code in
      the app.** No UI beyond a bare project list.

- [ ] **Slice 2 — NanoGPT client & key management.** Typed API client (chat
      completions, image gen, video gen + unified status polling, models + pricing,
      check-balance, usage); MSW mocks for all of it; key entry screen with validation
      via check-balance; key stored locally, never logged; balance display; onboarding
      path for keyless users via the affiliate link (ADR-005 — verify referral mechanics
      against NanoGPT docs first).

- [ ] **Slice 3 — Script stage.** Write a script manually or generate one with a
      chosen text model; edit and lock the script. First real use of the **cost
      estimate before every generation** pattern — establish it well here, every later
      stage copies it.

- [ ] **Slice 4 — Scene breakdown stage.** Split the locked script into an editable
      list of scenes (text excerpt + visual description each); model-assisted breakdown
      with manual add/remove/reorder/edit; per-project style notes that carry into
      image prompts (consistency across scenes).

- [ ] **Slice 5 — Image stage.** Per-scene image generation with model picker and
      cost estimate; regeneration as versions (never overwrite — ADR pt. "never lose
      paid assets"); pick the active version; vertical 9:16 framing.

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
