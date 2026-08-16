# DECISIONS.md — Architecture Decision Records

Every significant decision gets a dated entry: context, decision, rationale,
alternatives rejected, consequences. Newest entries at the bottom. Superseded
decisions are marked, never deleted.

---

## ADR-001 — Client-side-only PWA, bring-your-own-key (2026-08-16)

**Context.** Kairo's pitch is "pay only for what you generate." Users supply their
own NanoGPT API key. The question was whether Kairo needs a backend.

**Decision.** Kairo is a pure client-side PWA. No backend, no accounts, no server.
The API key is stored on the user's device and requests go browser → NanoGPT
directly. Projects and generated assets are stored locally (IndexedDB + OPFS).

**Rationale.** Zero hosting/server cost; no liability for holding users' keys;
strongest possible privacy story ("your key never touches our servers"); the app is
static files, hostable free on GitHub Pages. CORS viability is confirmed — Angel has
already shipped PWAs calling the NanoGPT API from the browser.

**Alternatives rejected.** (a) Client + small proxy backend — unnecessary since CORS
works; adds cost and a trust liability. (b) Full backend with accounts/sync —
possible v3 territory, not needed for the core value.

**Consequences.** Long-running video jobs must be handled with client-side polling
and resumable state. Projects are per-device unless we later add an export/import
project file (planned) or optional sync (future).

---

## ADR-002 — React + Vite + TypeScript (2026-08-16)

**Decision.** Frontend stack is React 18+ with Vite and strict TypeScript, built as
an installable PWA (vite-plugin-pwa).

**Rationale.** Largest ecosystem and tooling maturity; TypeScript's strict mode
catches an entire class of pipeline-state and data-model bugs at compile time, which
matters in an app whose core is a state machine over paid assets.

**Alternatives rejected.** Svelte/SvelteKit (lighter output but smaller ecosystem),
Vue (fine, no decisive advantage), vanilla (too costly for an app this stateful).

**Amendment (2026-08-16, Slice 0).** create-vite now ships oxlint instead of
ESLint; we kept oxlint (+ Prettier for formatting) rather than swapping ESLint
back in. Scaffold landed on React 19, Vite 8, TypeScript 6 with `strict` and
`noUncheckedIndexedAccess` enabled.

---

## ADR-003 — V1 scope: shorts only (2026-08-16)

**Decision.** Version 1 produces vertical short-form videos only: ≤60 seconds,
roughly 5–10 scenes. Long-form is explicitly v2.

**Rationale.** Shorts exercise the entire pipeline end-to-end while keeping
real-money test generations cheap and the scene count manageable. Long-form is the
same pipeline multiplied — better added after the foundation is proven.

**Alternatives rejected.** (a) Both from the start — multiplies edge cases and cost
handling before the core works. (b) Images-only storyboard v1 — too small; animation
is the product's heart and its riskiest integration, so it belongs in v1.

---

## ADR-004 — Export: individual clips + optional stitched draft (2026-08-16)

**Decision.** Export produces a zip of numbered scene clips (plus the script as a
text file). Optionally, the user can also generate a single stitched draft MP4,
assembled in-browser with ffmpeg.wasm.

**Rationale.** Individual clips are what a video editor actually wants to import;
the stitched draft gives a fast preview and a quick-publish path for users who skip
external editing. Polishing/publishing remains out of scope.

**Alternatives rejected.** Clips-only (loses the preview/quick-publish path);
stitched-only (hostile to the "polish in your own editor" workflow).

---

## ADR-005 — Monetization: NanoGPT affiliate/invite code only (2026-08-16)

**Context.** Kairo is free and must stay cheaper than subscription competitors.

**Decision.** The sole revenue stream is Angel's NanoGPT affiliate/invite code.
During onboarding, users without a NanoGPT account are offered account creation
through the affiliate link. Users with existing accounts just paste their key —
nothing is paywalled, ever.

**Rationale.** Costs users nothing extra, so it doesn't undermine the pay-per-use
pitch; aligns Kairo's incentives with users actually generating things.

**Implementation notes.** The affiliate code/link lives in a single config constant
(easy to audit in the public repo — transparency here builds trust). NanoGPT exposes
an invitations API (`invitations-create` endpoint); verify the exact
referral-link mechanics against current NanoGPT docs before building onboarding.

**Consequences.** A fork could swap the code and rehost — accepted risk, mitigated
by ADR-006's license and by being the canonical, best-maintained version.

---

## ADR-006 — Public repo on GitHub, AGPL-3.0 (2026-08-16)

**Context.** Since revenue is affiliate-only, is open-sourcing safe?

**Decision.** The repo is public on GitHub under AGPL-3.0.

**Rationale.** The app is client-side, so shipped code is readable in the browser
anyway — a private repo only deters the laziest cloners while sacrificing the
strongest trust argument a BYOK app has: "read the code, verify your key never
leaves your device." AGPL adds a real deterrent to commercial rehosting: anyone
serving a modified version must publish their changes. Public repo also enables free
GitHub Pages hosting and community contributions. (Strategy input, not legal advice.)

**Alternatives rejected.** MIT (explicitly permits fork-swap-rehost), PolyForm-style
source-available (stronger protection but loses "open source" standing and
community goodwill), private repo (protects little, costs trust).

---

## ADR-007 — Aesthetics and i18n deferred to end of project (2026-08-16)

**Context.** Angel's direction: focus on getting everything working; visual
design polish and internationalization come at the end, once the product is
mostly done.

**Decision.** Until all v1 feature slices are complete, the UI stays minimal and
utilitarian. No effort goes into visual polish, and Claude does not propose
beautification work. i18n (additional languages) is likewise out of scope until
the end. Two dedicated slices exist at the end of the roadmap: a full design
pass, then i18n.

**Rationale.** Design iterated before features stabilize gets redone; polishing
last avoids paying twice. Same for translating strings that are still changing.

**What we still do now (to keep the retrofit cheap).**

- All styling goes through the token layer in `src/index.css` — no ad-hoc hex
  values or magic numbers — so the design pass is largely a token swap plus a
  component sweep.
- User-facing strings stay out of `src/lib` domain code, and UI text is written
  as whole sentences (never concatenated fragments), so string extraction for
  i18n is mechanical.

**Alternatives rejected.** Design-system-first (contradicts Angel's direction;
risks rework), i18n-from-day-one (infrastructure overhead while copy is
unstable).

---

## ADR-008 — Visual style presets with pregenerated thumbnails (2026-08-16)

**Context.** Angel's product insight: users choosing an artistic style for
their images should SEE the styles, not just read their names.

**Decision.** Kairo ships a curated catalog of artistic style presets
(~15-20: watercolor, anime, oil painting, pixel art, claymation,
photorealistic, etc.). Each preset has an id, display name, a prompt
fragment, and a small pregenerated thumbnail. All thumbnails depict the SAME
reference subject so users compare styles, not pictures. The picker UI lands
in Slice 5 (image stage); the domain field (`Project.stylePresetId`) is added
in Slice 4 to avoid a schema migration later.

**Thumbnail pipeline.** Generated once with Angel's key via the NanoGPT image
API (one-time cost roughly $0.20 for ~20 styles), optimized to small webp
(~256px), committed as static assets under `public/styles/`. Users never pay
for them. Regenerating the catalog is a documented script, not a manual
process.

**Interaction with style notes.** Preset and free-text style notes compose:
the preset's prompt fragment sets the base look; `styleNotes` fine-tunes it.
Both are prepended to every scene image prompt for cross-scene consistency.

**Alternatives rejected.** Text-only style list (exactly the UX gap Angel
identified); generating style previews per-user at runtime (charges every
user for the same pictures); licensing stock style images (inconsistent
subjects defeat comparison, plus licensing complexity for an AGPL repo).
