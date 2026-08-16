# CLAUDE.md — Kairo

> **Read this file at the start of every session.** Then read `docs/DECISIONS.md`,
> `docs/LESSONS.md`, and `docs/ROADMAP.md`. At the end of every session, update them:
> new decisions → DECISIONS.md, mistakes + the rule that prevents them → LESSONS.md,
> progress → ROADMAP.md.

## What Kairo is

Kairo is a free, open-source PWA that lets creators produce a YouTube video (shorts
first, long-form later) through a step-by-step pipeline: **script → scene breakdown →
image per scene → animated clip per scene → export**. Users bring their own NanoGPT
API key and pick their preferred model at every step, paying only for what they
generate — no subscription. The exported clips are meant to be polished in the user's
own video editor; publishing is out of scope.

Monetization: Kairo itself is free. Revenue comes solely from the owner's NanoGPT
affiliate/invite code, offered to users who don't yet have a NanoGPT account.

## Stack and architecture (summaries — full reasoning in docs/DECISIONS.md)

- **React + Vite + TypeScript**, built as an installable PWA (ADR-002).
- **Client-side only. No backend.** The user's API key is stored on-device and calls
  go browser → NanoGPT directly. CORS is confirmed workable (owner has shipped PWAs
  on this API before). Nothing sensitive ever leaves the device except calls to
  NanoGPT itself (ADR-001).
- **Persistence:** project documents in IndexedDB; generated binaries (images, video
  clips) in OPFS. Everything survives tab close and is resumable.
- **Export:** zip of numbered scene clips + optional stitched draft MP4 assembled
  in-browser with ffmpeg.wasm (ADR-004).
- **License:** AGPL-3.0, public repo on GitHub (ADR-006).

## NanoGPT API notes

Docs: https://docs.nano-gpt.com (full index: https://docs.nano-gpt.com/llms.txt)

Endpoints we rely on: OpenAI-compatible chat completions (script/scene text);
image generation; video generation (text-to-video and image-to-video) with a
**unified video status endpoint for polling** long jobs; `/models` (+ image-models,
video-models variants) **with pricing info** — use this to drive model pickers and
cost estimates; `check-balance` and `usage` — use these for the balance display and
cost dashboard. Verify exact request shapes against the docs before implementing;
do not code from memory.

## Product principles (non-negotiable)

1. **Cost transparency before every click.** Every generation button shows an
   estimated cost first; the project's running total and account balance are always
   visible. This is Kairo's differentiator vs. subscription competitors.
2. **Never lose paid assets.** Persist every generated image/clip immediately.
   Regenerations create versions; nothing is overwritten. Export must always work,
   even for a half-finished project.
3. **Everything is resumable.** Each scene is an explicit state machine
   (`pending → generating → ready | failed`). Closing the tab mid-generation and
   returning later must be safe.
4. **The key is sacred.** The API key is stored locally, never logged, never sent
   anywhere but NanoGPT. The public repo lets users verify this.

## Working agreement (how Claude and Angel build this)

- **Plan first.** For any non-trivial feature: Claude proposes a short written plan,
  Angel approves or redirects, then implementation starts. No unplanned building.
- **Small vertical slices.** One slice = one working end-to-end piece (see
  ROADMAP.md). Never implement multiple pipeline stages in a single pass.
- **Session ritual.** Start: read the four docs. End: update them. A decision that
  lives only in chat history is a decision lost.
- **When something Claude built annoys Angel**, that's a LESSONS.md entry, not just
  a fix. The docs accumulate taste over time.

## Testing rules

- **NEVER call the real NanoGPT API from tests.** All tests mock at the API-client
  boundary (e.g. MSW). Real generations cost real money and are non-deterministic.
- Unit tests (Vitest) are mandatory for the three places bugs actually hurt:
  the **pipeline/scene state machine**, the **cost calculator**, and the
  **persistence layer** (IndexedDB/OPFS wrappers).
- Playwright covers the critical user flows (create project → complete pipeline with
  mocked API → export).
- Tests must pass before a slice is called done. A slice with failing tests is not
  done, regardless of how it looks.

## Design rules

- **Aesthetics are deferred until features are complete (ADR-007).** Until the final
  design pass, the UI stays minimal and utilitarian — do not spend effort on visual
  polish, animations, or beautification, and do not propose it.
- **i18n is also deferred (ADR-007).** English only for now. Two cheap habits apply
  today so the retrofit stays cheap: keep user-facing strings out of `src/lib`
  domain code, and write whole sentences (no string concatenation of fragments).
- All styling still flows from the tokens in `src/index.css` (colors, type scale,
  spacing, radii). **No ad-hoc hex values or magic pixel numbers** in components —
  this is what makes the final design pass a token swap instead of a rewrite.
- After any UI change, Claude screenshots the result and reviews it before
  presenting it. Visual bugs caught by looking are cheaper than review round-trips.
- Desktop is the primary editing environment; layouts must degrade gracefully to
  tablet. (Shorts _output_ is vertical; the _tool_ is desktop-first.)

## Commands

```bash
npm run dev          # dev server at http://localhost:5173
npm test             # unit tests (Vitest, jsdom)
npm run test:watch   # unit tests in watch mode
npm run e2e          # Playwright e2e (runs against the production preview build)
npm run lint         # oxlint
npm run format       # Prettier write; format:check in CI
npm run build        # tsc -b typecheck + vite production build (includes PWA/SW)
```
