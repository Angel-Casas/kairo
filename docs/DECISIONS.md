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

---

## ADR-009 — References: one concept for subject consistency (2026-08-21)

**Context.** Two overlapping ideas targeted the same problem — the image model
has no memory, so the same character described twice comes out as two people.
The roadmap had "asset passports" (per-project text descriptors, tagged per
scene, injected verbatim). Angel then proposed base reference images: generate
or import an image of a character/landscape/style once, and tick per scene
which scenes use it as an image-to-image base, plus a per-scene toggleable
base prompt.

**Decision.** Merge both into a single concept: a project-level **Reference**
(kind: character, location, or art style) with a name, an exhaustive text
descriptor, and an optional reference image. Scenes tick the references they
use. A ticked reference always injects its descriptor VERBATIM into that
scene's image prompt (between style notes and the scene description; never
shortened — a variant is a separate reference). If the reference has an
active image and the chosen model supports image-to-image, the image is also
attached via the NanoGPT `input_references` array (docs-verified; never mixed
with legacy image aliases like `imageDataUrl`, which the API rejects).
Reference images are append-only `AssetVersion`s like scene assets: imported
files are free; in-app generation runs through the normal job + cost-log
machinery and composes the project style (preset + style notes) with the
descriptor so references match the project look.

**Model capability is surfaced honestly.** The image model picker labels
i2i-capable models ("accepts reference images") and offers a filter; when the
selected model lacks the capability, the scene card says the images will be
skipped while descriptors still apply — generation is never blocked and
nothing is silently dropped.

**Alternatives rejected.** (a) A third per-scene "base prompt" layer separate
from references — the always-on case is already covered by style preset +
style notes, and per-scene toggling is exactly what reference ticks do; three
prompt systems would be confusing to explain. (b) Reference images without
descriptors — loses the ability to say what the subject is doing per scene
and does nothing for non-i2i models. (c) Blocking non-i2i models when a scene
has reference images — punishes model choice; honesty note instead.

**Consequences.** `Project.references` and `Scene.referenceIds` are additive
schema fields (backfilled by `normalizeProject`, no version bump);
`.kairo` import re-roots reference image blob paths; the video stage is
unaffected (clips inherit identity from the scene image they animate).

## ADR-010 — Design system: blended bubbles, glass panels, ten palettes (2026-08-21)

**Context.** ADR-007 deferred aesthetics to a dedicated slice. Angel wanted a
pastel-modern look that does not read as template output: several exploration
rounds on a design canvas converged on the Aurora Glass direction (Dusk
variant), then — guided by screenshots from his Bonsai project — on a backdrop
of very large soft color fields ("bubbles") that blend into the ground color,
plus a fine diagonal hatch to break the uniformity. Two earlier directions
were explicitly rejected: small blurred blobs ("classic AI-agent look") and
any background with straight edges or a visible division between color fields.

**Decision.**

- **Backdrop.** A fixed full-viewport layer (`AppBackground`) with five huge
  radial-gradient divs over a solid ground color, under a repeating 133°
  1px/4px hatch. Every gradient is explicitly sized `50% 50% at 50% 50%` so it
  reaches zero alpha inside its own box — the default farthest-corner sizing
  leaves nonzero alpha at the div edges and paints hard seams (this bug
  shipped twice on the canvas before being caught in Angel's screenshots).
- **Themes.** Ten palettes — five dark (Emberlight, Lagoon, Orchid, Citrus,
  North Sea), five light (Golden Hour, Sea Glass, Peony, Meadow, Lilac Dawn) —
  live in `src/domain/themes.ts` as the single source of truth. `applyTheme()`
  writes them as CSS custom properties on `<html>` plus `data-theme`/
  `data-mode`; `src/index.css` carries the default dark values so the first
  paint before React mounts is already correct. Components keep the ADR-007
  token rule: variables only, no ad-hoc hex or magic numbers.
- **Theme state.** Mode (dark/light) and one palette _per mode_ are user
  choices in the navbar, persisted in localStorage (`kairo.ui.mode`,
  `kairo.ui.theme.dark`, `kairo.ui.theme.light`); with no stored mode the app
  follows `prefers-color-scheme`. Switching modes returns to that mode's own
  last palette.
- **Surfaces.** Panels are translucent white "glass" cards (`.card`:
  `--color-surface` + border + 22px radius + soft shadow) over the backdrop;
  controls are pill-shaped (`--radius-pill`), with one `.primary` CTA style
  (solid, high-contrast) per surface for the main action. Inputs, selects,
  and textareas share the glass treatment globally in index.css.
- **Chrome.** A top navbar: app name left; balance + open-project spend in
  the middle (hidden under 860px — small screens keep the CostSummary inside
  the project view); palette dropdown, light/dark toggle, and Settings gear
  right, with room reserved for the Slice 14 language dropdown.
- **Type.** Instrument Sans via Google Fonts with the system stack as offline
  fallback (the PWA must not depend on the font loading).

**Alternatives considered.** A CSS framework or component library (rejected:
the point is a distinctive look, and the app's surface is small); per-theme
surface/border colors (rejected for now: white-alpha surfaces work across all
ten palettes and keep the theme objects small); storing one global palette
(rejected: a palette is only meaningful within its mode, so each mode keeps
its own).

**Consequences.** Animations and transitions are deliberately absent — they
are the next slice, and the backdrop was built static-first so motion can be
added in one place. jsdom never runs `applyTheme` implicitly (it is called
from an App effect), so unit tests assert on it directly; e2e pins
`colorScheme: 'dark'` where the dark default matters. The navbar spend label
avoids the substring "project spend" so Playwright's substring `getByLabel`
never collides with CostSummary.

## ADR-010a — Navbar follow-up: one palette dropdown, settings as overlay (2026-08-21)

**Context.** Right after Slice 13 shipped, Angel simplified the chrome: the
separate light/dark toggle wastes navbar space, and settings as a separate
view loses the user's place in the pipeline.

**Decision.** (a) One swatch dropdown (modeled on a reference screenshot from
Angel's other project) lists all ten palettes; choosing a palette also
switches to its mode via `chooseTheme` — mode stops being a separate control
while the per-mode palette memory and the `prefers-color-scheme` default stay.
The trigger and each row render the palette as a 2×2 tile of ground / cool
bubble / accent / warm bubble. (b) Settings renders as a fullscreen
`.settings-overlay` (frosted `color-mix` veil, page mounted behind, header
above it) and the gear button becomes an X while open; Escape closes it.

**Consequences.** `selectTheme`/`setThemeMode` remain as primitives (and for
tests); the UI only calls `chooseTheme`. The e2e helper closes settings via
"Close settings" now. The overlay and dropdown are the first components that
will need enter/leave transitions in the animation pass.

## ADR-011 — Filmstrip workflow: transport deck, the reel, poster wall (2026-08-21)

**Context.** After Slice 13 the pages still ran as one narrow centered column:
wide desktop screens wasted both sides while long stages (Scenes, Images)
scrolled forever. Angel called the result generic and asked for a distinctive
workflow presentation. Five layout directions went through the design canvas;
Filmstrip won, then its pipeline nav went through two more pick-one rounds
(three nav concepts, then five Transport-deck stylings — Segmented rail won).

**Decision.** The app presents the workflow as film-making equipment:

- **Transport deck** (`StagesNav`, kept name): pipeline navigation is a
  film-leader scrubber — previous-stage button, track with progress fill,
  stop dots and a playhead, next-stage CTA pill, all on one center line —
  over a segmented rail: one continuous glass control, one named clickable
  segment per stage. Stage labels lost their number prefixes. State icons
  are hand-drawn SVGs: a punched-reel check (done), an aperture mark
  (current, with a progress note like 4/6), a film-canister padlock
  (locked). Locked segments and deck buttons disable exactly like the old
  nav (same `StageItem.available` gates and hints).
- **The reel** (Images and Animation stages): scenes run horizontally as
  9:16 frames between film-perforation strips (`ReelShell`); selecting a
  frame drives a three-panel workbench below (prompt / generate / takes for
  images; motion / animate / clips for video). Six scenes now fit one
  screen. All Slice-6.1/10/11 behavior is preserved: batch generation,
  reference attachment notes, verbatim history regeneration, and the video
  cost-confirmation dialog.
- **Poster wall** (`ProjectList`): projects are 9:16 one-sheets with the
  title on a plate; posters wear a deterministic gradient seeded from the
  project id and mixed from the active theme's bubble colors, so the wall
  follows every palette. Create/import moved into the page header.
- **Width**: main container widened to 96rem; Script stays a 64rem reading
  column; Scenes becomes a responsive card grid; Export's three panels sit
  in one row.

**Alternatives considered.** Cockpit (sticky control column + gallery grid) —
strongest ergonomics, rejected as too conventional; Constellation, Broadsheet,
Atelier — rejected by Angel in review. For the nav: slate tabs and countdown
dial lost to the playhead; chips, underline tabs, tickets and keycaps lost to
the segmented rail.

**Consequences.** E2e stage-nav selectors use exact names now ('Scenes', not
'2. Scenes') — exactness matters because getByRole substring-matches and
stage names appear inside other button labels. Scene interactions in specs go
through the selected-frame workbench (`Scene N workbench` /
`Scene N animation workbench`) instead of per-scene list items. The reel is
the second component (after the settings overlay) queued for the animation
pass — frame selection, playhead travel and rail transitions should all move.

## ADR-012 — Audio stage: per-scene TTS narration with exact pricing (2026-08-22)

**Context.** Scenes carried text and pictures but no voice: the exported
shorts had nothing to say. NanoGPT exposes an OpenAI-compatible
`POST /v1/audio/speech` endpoint (raw audio bytes back, no job polling) that
is billed **by input character count** — unlike tokens, the price of a
narration is knowable to the cent before the request leaves the browser.
There is no TTS model-listing endpoint, so models cannot be discovered at
runtime the way text/image/video models are.

**Decision.** A dedicated **Audio** stage sits between Scenes and Images
(gated on a locked script + scenes existing, and skippable — Images never
waits for narration):

- **Curated catalog** (`src/domain/ttsModels.ts`): a hand-checked list of
  NanoGPT TTS models (Kokoro-82m as the cheap default, the OpenAI tts
  family, ElevenLabs Turbo) with per-1k-char prices, voice lists and input
  caps, since the API offers no listing to fetch. Updating it is a code
  change, reviewed like any other price surface.
- **Exact cost, not an estimate**: `ttsCostUsd(model, text)` =
  chars/1000 × price. The UI says "Exact cost" (and the narration-text
  panel explains why); the cost log records the same number for estimate
  and actual. `formatUsd` learned to keep at least two significant digits
  below a cent so a $0.000055 narration never renders as "$0".
- **Narration text = the scene's script excerpt, verbatim** — what you read
  is exactly what is billed and narrated. Edit-and-regenerate (Slice 11
  history pattern) passes edited text as an override with the price
  recomputed live.
- **Takes are append-only `AssetVersion`s** (kind `'audio'`, stored in
  OPFS like frames and clips), with the same active-version switch,
  history viewer and generation-job lifecycle (`withGenerationJob`, kind
  `'audio'`) as images and video. Schema stays additive:
  `scene.audioVersions`/`activeAudioVersionId` backfilled by
  `normalizeProject`.
- **Animation integration**: the clips panel plays the scene's narration
  next to the clip and shows its duration ("narration runs 4.2s") so clip
  length can be chosen to match. The clips zip exports `narration-NN.mp3`
  for every narrated scene — clipless scenes included, so a voice-only
  scene still ships its audio.

**Alternatives considered.** Fetching TTS models from `/v1/models` —
rejected: they are not listed there. Narrating the whole script as one
take — rejected: per-scene audio is what the Animation stage and the
export zip need to sync clips against. Blocking Images behind Audio —
rejected: narration is optional by design (silent shorts with captions are
a real use).

**Consequences.** The stage rail grew to six segments (Script → Scenes →
Audio → Images → Animation → Export); e2e nav tests that asserted "next is
Images" now expect Audio. `GenerationKind`/`AssetKind` accept `'audio'`
everywhere (job resume included). Voice previews would cost real money, so
voices are picked by label only — a future slice could cache one sample
per voice.
