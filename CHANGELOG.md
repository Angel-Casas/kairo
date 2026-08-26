# Changelog

Notable changes per slice. Dates are completion dates.

## Slice 22.21.2 — The palette picker comes back on-screen in RTL (2026-08-26, Angel's report)

- The palette dropdown anchored itself with a physical `right: 0` —
  correct in LTR where the nav icons hug the right edge, but in
  Arabic/Urdu the icons sit at the LEFT of the screen, so the panel
  opened straight off-screen to the left. It now anchors with
  `inset-inline-end: 0`, exactly like the language menu, and a sweep
  of the components found no other one-sided physical anchors (every
  remaining left/right pair is a full-width stretch, safe in both
  directions).

## Slice 22.21.1 — The stage rail learns to mirror (2026-08-26, Angel's report)

- In Arabic/Urdu the rail's end segments kept rounding their PHYSICAL
  corners — "round the left" stayed the left even though RTL puts the
  first segment on the RIGHT — so the white active fill poked square
  past the pill's curve at both ends. The end segments now use logical
  corner radii (border-start-start-radius & friends) and the hairline
  separator moved to border-inline-end, so the curves follow the
  reading direction with no per-direction branching at all.
- The transport deck above it mirrors properly too: the tape fill,
  stop dots, and playhead are positioned from inset-inline-start (with
  translateX signs flipped in RTL, since transforms stay physical),
  the fill gradient runs toward the inline end, and the prev/next
  glyphs flip with scaleX(-1) — in Arabic the film now spools
  right-to-left, matching the page.
- New `useLanguageDir()` in src/i18n for the few components that
  position things physically and must know the reading direction.

## Slice 22.21 — Kairo speaks ten languages (2026-08-26, Angel's request)

- The last empty seat in the navbar is filled: a globe button opens a
  language dropdown with the ten most-spoken languages in the world
  (Ethnologue, total speakers) — English, 中文, हिन्दी, Español,
  Français, العربية, বাংলা, Português, Русский, اردو. Each row shows
  the language's own name for itself with the English name as a quiet
  second line; the rows are plain buttons ON PURPOSE, so every one
  wears the same spinning pastel hover ring as the rest of the app
  (Angel's ask) — the panel keeps padding/gap room for the -4px ring
  and never gains overflow:hidden (the 22.9/22.19 trap).
- The i18n core is deliberately tiny (src/i18n/): English source text
  IS its own key. `useT()` hands components a `t()` that looks the
  sentence up in the active language's dictionary and falls back to
  the English it was handed — an untranslated string simply stays
  English, never blank, never a crash. `{slots}` interpolate after
  lookup so translations reorder them freely.
- English stays the default, so every pinned e2e keeps passing
  untouched. The choice persists like the theme (localStorage
  `kairo.lang`) and rides the document root: `lang` for assistive
  tech, `dir` so Arabic and Urdu flip the whole layout right-to-left
  — the header, posters, and forms all mirror.
- Nine hand-written dictionaries (~410 entries each) cover the app
  chrome, the stage rail, all six pipeline stages, References,
  Settings, Feedback, the spend ledger, model pickers, and every
  confirm dialog. Model-facing prompts (src/domain/prompts.ts) stay
  English on purpose — they are instructions to the generation
  models, not UI. A few deep corners (voice picker, lightbox chrome,
  batch overlay, camera-help essay) fall back to English for now and
  pick up translations in a follow-up.
- Tests: 13 i18n unit tests (fallback, interpolation, persistence,
  RTL, and a dictionary-integrity check that no translation invents a
  `{slot}` the English key lacks — it caught one real miss on the
  first run) plus a new e2e suite: all ten languages listed, Spanish
  translates and survives reload, Arabic flips `dir` and back.

## Slice 22.20.1 — README joins the referral policy (2026-08-26, Angel's call)

- The README's NanoGPT link now uses the referral URL the app already
  ships in config.ts (ADR-005: Kairo's only monetization), WITH the
  disclosure spelled out — "supports Kairo's development at no extra
  cost to you". Transparent everywhere the link appears.
- Caught in passing: the landing footer claimed "MIT license" while
  LICENSE is AGPL-3.0 — the label now tells the truth.

## Slice 22.20 — The GitHub links go live (2026-08-26, Angel's repo)

- The repository has a home: https://github.com/Angel-Casas/kairo.
  feedback.ts drops its "your-user" placeholder and now re-exports
  REPO_URL from config.ts — one source of truth — so the Support
  overlay's "Open on GitHub ↗" and prefilled issue links point at the
  real issues page.
- The landing page's four dead links wired: the "Star on GitHub"
  pill, "Read the code", and the footer's GitHub + MIT license (the
  license links straight to LICENSE on GitHub).

## Slice 22.19 — Posters come off the wall (2026-08-26, Angel's request)

- The poster wall had no hover response at all — the global pastel
  ring exists on every button, but the poster's overflow:hidden clips
  it (the 22.9 toggle trap again), so pointing at a production showed
  nothing.
- Posters now get their own move on hover: the one-sheet lifts off
  the wall (translateY + a whisper of tilt) with an accent border and
  soft glow, the artwork inside eases into a slow 6% zoom — a poster
  picked up for a closer look — the empty-poster K mark swells
  slightly, and an "Open →" hint fades in at the top corner so the
  click's meaning is stated. Hover only, by Angel's call — keyboard
  focus keeps its existing treatment. Reduced motion collapses the
  transitions to instant state changes.
- projects e2e suite green.

## Slice 22.18 — The ledger's hover-linking (2026-08-26, Angel's request)

- In the Production ledger, pointing at a legend tile ("Text",
  "Narration", "Images", "Clips") or at any receipt row now lights
  that kind's segment in the composition bar (slightly saturated and
  brightened) while the rest of the bar dims to 20% — one glance
  answers "where does this money sit in the whole". Hovering a bar
  segment itself does the same, and the hovered tile's border tints
  to its series color.
- Pure hover state, cleared on every close path (Close, veil,
  Escape); the bar's aria description and the receipt stay the
  accessible record — the linking is a sighted-reading accelerator,
  not the only channel.

## Slice 22.17 — Every poster earns its face (2026-08-26, Angel's request)

- The poster wall showed every production in the same stock gradient
  — two finished films, indistinguishable but for their titles. Now a
  project with artwork wears its OWN opening frame: the first scene's
  active image fills the poster, so the wall becomes a real one-sheet
  gallery of your productions.
- Projects without images yet get a deterministic AURORA: three of
  the six ring pastels picked and placed by a hash of the project id
  (two radial glows over an angled wash), so no two posters match and
  each keeps its art between visits — under a faint Projector-K
  watermark so the empty poster still feels like Kairo. The pastels
  follow the theme, so light palettes get the jewel-tone set.
- The plate gains a second line of real metadata: format ratio, scene
  count, clip count — before the updated timestamp.
- 304 unit tests; projects + smoke suites green.

## Slice 22.16 — The cutoff caution (2026-08-26, Angel's mistake to make once)

- Angel animated a 5s clip for a scene whose narration runs 8s — the
  voice gets cut mid-sentence in the final video, and nothing warned
  him before the money was spent. (Animate-all has auto-fit durations
  since 15.11; the single-scene Animate button was the gap.)
- The cost-confirmation dialog now measures the scene's active
  narration at click time (blob decoded with its stored MIME type
  restored) and, when the chosen clip is shorter, shows an
  accent-bordered caution: narration length, clip length, "the
  narration gets cut off mid-sentence", and the ways out. Cancel stays
  focused; nothing is submitted until the user decides.
- narrationCutoffWarning lives in lib/clipDuration.ts with a 0.25s
  rounding grace and stays quiet when lengths are unknown; the
  ConfirmDialog gains an optional `warning` prop (accent, role=alert)
  for confirmations that are technically fine but probably a mistake.
  Lip-sync submissions never warn — the narration defines their
  length.
- 304 unit tests (3 new); animation + audio e2e suites green.

## Slice 22.15 — The developing veil (2026-08-26, Angel's request)

- Long-running work only showed in the FilmProgress strip below the
  controls — the frame being worked on sat still. Now it visibly sits
  in the developing bath: Kairo's signature pastel projector ring
  spins around the frame's edge (the hover ring's conic band, ON for
  the duration) while a soft beam of darkroom light sweeps diagonally
  across the print. New DevelopingVeil component, pure decoration
  (aria-hidden, pointer-events none) — the caption text and the strip
  remain the accessible status.
- Worn by: the Images reel frame while its image generates, the
  Animation reel frame while its clip animates, the "Break into
  scenes with AI" card while the breakdown runs, and reference
  thumbnails while generating or being described.
- The sweep sheet is oversized with both keyframe ends parked
  off-frame, so the loop restart is invisible. Under reduced motion
  the globals freeze it: beam parked off-frame, ring standing still
  as a quiet pastel border — a static busy mark.
- 301 unit tests; images, animation, scenes, references suites green.
- 22.15.1 (Angel's follow-up): the bottom-caption "generating…" was
  easy to miss on a frame that already holds an image — the veil now
  floats a centered mark over the print ("Generating…" on a
  regenerating Images frame, "Animating…" on an Animation frame). The
  empty-frame placeholder keeps its own centered text; captions
  remain the accessible status.
- 22.15.2 (Angel's polish): the mark looked like a button — the pill
  and border are gone. Now it is a thin white arc spinning above bare
  text, both under soft shadows so they read over any artwork; under
  reduced motion the arc freezes into a notched circle, still a busy
  mark.

## Slice 22.14 — The saved reference asks for its description (2026-08-26, Angel's idea)

- 22.13's flow had a quiet failure mode Angel hit immediately: save
  the exiled-boy image as a reference, generate the next scene — and
  the look drifts, because the new reference has no DESCRIPTION, and
  the description is the channel that actually rides the prompt.
- The saved notice now earns its keep: an accent-bordered box that
  states the risk plainly ("without one the look will drift"), beats
  the new attention-pulse a few times (finite by design — it asks for
  a glance, it does not nag; silenced by reduced motion like all
  Kairo animation), and carries a "Describe it now →" button.
- The button jumps straight to the Scenes stage with the new
  reference card scrolled into view and wearing the same pulse — one
  click from save to describing. Auto-navigating was considered and
  rejected: the user may want to keep generating; the jump stays
  theirs to take.
- Plumbing: the pipeline stage moved from ProjectView's useState into
  a small UI store (src/state/ui.ts) so any stage can send the user to
  another; each project still opens at Script.
  createReferenceFromSceneImage now returns the new reference's id.
- e2e: the save flow now travels via "Describe it now" instead of the
  nav rail. Images suite green; 301 unit tests.

## Slice 22.13 — References evolve with the story (2026-08-26, Angel's request)

- Angel's last-emperor project surfaced the gap: the story stripped
  the boy of crown and cape mid-arc, but the reference image still
  wore them — so later scenes snapped back to full regalia. Two
  changes in the Images workbench:
- "Save image as reference": name it, click, and the scene's active
  image is copied (free) into a NEW reference — kind, name, and
  description all editable on the References panel like any other,
  removable with the thumbnail X. It starts ticked on the scene it
  came from, and a notice points at the References panel for the
  description (the channel that rides the prompt). New store action
  `createReferenceFromSceneImage`.
- The workbench's reference chips are now TOGGLES: every project
  reference shows as a chip (ticked = accent + ✓ when it has an
  image; unticked = dashed, muted), and clicking ticks or unticks it
  for that scene in place — no more round-trip to the Scenes stage to
  fix a mis-ticked reference. The 22.2 no-description warnings keep
  watching the ticked set.
- e2e: generate → save as reference → chip arrives pressed → the
  Scenes stage shows the same card and tick → untick in place from
  Images → persisted. Images + references suites green; 301 unit
  tests.

## Slice 22.12 — Model choices survive the pipeline (2026-08-26, Angel's report)

- Every stage held its model selection in component useState, so
  leaving a stage threw the choice away — Images → Audio → Images and
  the model had to be picked again, every time.
- New src/state/modelChoices.ts: choices keyed by picker slot
  ("images.image", "audio.tts", …), mirrored to localStorage — they
  now survive stage hops AND full reloads. Only IDs are stored; each
  stage re-resolves them against the live catalog, so a model that
  vanished from NanoGPT simply comes back unselected instead of
  crashing anything.
- Wired everywhere a model is picked: Script and Scenes text models,
  Images image model, References image + describe models,
  style-from-image vision model, Animation video + lip-sync models,
  Audio narration model AND voice (the voice falls back to the
  model's first voice when the remembered one belongs to another
  model). Resolutions still auto-default from the project format.
- e2e: pick on Images → wander to Audio → return → still picked →
  reload → still picked → Scenes' own choice remembered
  independently. 301 unit tests; images, references, audio,
  animation, scenes, script, styleFromImage suites green.

## Slice 22.11.1 — Hide the half-wired Grok 2.0 Edit (2026-08-26, Angel's verification)

- With 22.11's fix, reference generation works across models — except
  xai/grok-imagine-image/v2.0/edit, which still answers "requires at
  least one input image" while the new diagnostic confirms Kairo
  attached one. Angel checked NanoGPT's own site: the model isn't even
  listed there — a half-wired catalog entry on their side.
- The model joins the broken-model blocklist (same discipline as the
  vibevoice TTS hide): filtered out of the image catalog with a dated
  comment; re-test before un-hiding. The working Grok Imagine Image
  and both Quality variants stay listed.
- New OPFS-mime lesson recorded in docs/LESSONS.md. 298 unit tests.

## Slice 22.11 — Reference images keep their true type (2026-08-26, Angel's report)

- Angel's regenerate with Rómulo ticked died with "Grok Imagine Image
  2.0 Edit requires at least one input image" while the workbench
  promised one would attach. Root cause found in our own data URLs:
  OPFS strips MIME types on read-back, and blobToDataUrl stamped every
  type-less blob `image/png` — an imported JPEG reached the API as
  `data:image/png;base64,/9j/…`, PNG label on JPEG bytes. Lenient
  providers sniffed past it; the new Grok 2.0 Edit pipeline drops the
  mislabeled reference and then reports no input image.
- blobToDataUrl now takes the version's STORED mimeType (recorded at
  creation, authoritative) and restores it — applied to scene i2i
  attachments, describe-from-image, and the image-to-video source
  frame (lip-sync audio already did this; now every path does).
- Two safety nets while we were in there: if the workbench promised
  attachments but none of the blobs could be loaded, generation now
  fails BEFORE spending money, with an error naming the fix; and if a
  provider still claims "no input image" on a request that carried
  references, the error now says how many Kairo attached — turning a
  contradiction into a diagnosis (provider-side gap, try another
  model).
- e2e now imports the reference as a JPEG and pins that the request
  carries `data:image/jpeg` — the stored type restored after OPFS
  stripped it. References + images suites green; 297 unit tests.

## Slice 22.10 — Reference images go fullscreen (2026-08-26, Angel's request)

- The same enlarge control the scene reels wear (arrows glyph, fades
  in on thumbnail hover) now sits on every reference thumbnail with an
  image, opening the SAME fullscreen Lightbox used by Images and
  Animation: dark veil, natural-best size, Escape or outside-click to
  leave.
- The lightbox walks every reference that has an active image with
  the arrow keys, with the reference's name as the caption plate and
  its description as the caption text — reviewing all your characters
  large, back to back, is exactly the consistency check references
  exist for.
- e2e: enlarge → dialog visible → Escape closes, pinned in the
  references suite. Reuses Lightbox untouched.
- 22.10.1 (Angel's follow-up): double-clicking the thumbnail enlarges
  too, matching the scene reels' dblclick-to-expand. Pinned in e2e.

## Slice 22.9.2 — References show the developing strip (2026-08-26, Angel's report)

- Generating on a reference card gave no wait signal beyond the
  disabled "Generating…" button — the Images and Animation stages show
  the FilmProgress developing strip, references showed nothing.
- The strip now flows under the generation block while the model
  works, in both directions: "Generating the image for Mara" /
  "Writing the description for Mara" (indeterminate — the API gives
  no partial progress for either call).
- Lesson re-learned: aria labels match by SUBSTRING — a first attempt
  labeled the strip "Reference Mara description generating", which
  shadowed the "Reference Mara description" textarea and broke strict
  mode. Progress labels now share no prefix with any input label.

## Slice 22.9 — The toggle wears one ring (2026-08-26, Angel's report)

- Hovering a toggle segment showed only a sliver of the pastel hover
  ring at the divider: the per-button ring sits 4px OUTSIDE each
  button, and the group's overflow:hidden clipped everything but the
  gap between segments.
- Segmented toggles now have their own ring rule: segments join the
  ring-exclusion list (same as rail segments and picker options), and
  the GROUP (.seg-group) wears a single ring around the whole control
  on hover — which is what the control is: one thing with two
  positions. The group drops overflow:hidden (it would clip its own
  ring); segments round their own outer corners instead.
- References e2e suite green (aria unchanged — styling only).
- 22.9.1 (Angel's follow-up): the ring's corners still didn't match
  the toggle's — the same radius drawn 4px further out always
  pinches. The toggle is now a PILL like every other Kairo button
  (999px radius stays concentric at any offset, which is why the ring
  looks right everywhere else); segments round their outer ends and
  gained a touch of horizontal padding to clear the curve.

## Slice 22.8 — Imports get a way out (2026-08-26, Angel's report)

- Angel imported an image, changed his mind, and found no way to
  remove it. Free versions now get one: an X on the thumbnail's
  corner (same glyph family as the app's other closers) whenever the
  ACTIVE version is free — imports — with a confirm dialog spelling
  out what happens (previous version becomes active, or the reference
  returns to "No image"; re-importing is free).
- New store action `removeFreeReferenceImageVersion`, the exact
  discipline of scene takes: only `costUsd === null` versions are
  removable — paid generations never show the X and never can be
  deleted. Blob deleted last, so a crash leaves an orphan file at
  worst, never a version pointing at nothing.
- New e2e: import → X → confirm → "No image"; a paid generation shows
  no X; the removal persists. 297 unit tests; references suite green.

## Slice 22.7 — One toggle, one dropdown, one Generate (2026-08-26, Angel's design)

- Angel simplified the reference card to its final shape: an Import
  button under the thumbnail (plain, free), a two-way toggle —
  "Generate image from description" | "Generate description from
  image" — and ONE model dropdown plus ONE Generate button that follow
  the toggle. His insight resolved the model-type problem: the two
  directions need different model kinds (image models vs. text models
  that read images), so the dropdown swaps catalogs with the toggle,
  and each direction remembers its own pick.
- Image mode shows the resolution select (format-defaulted) and the
  per-image cost; description mode shows the token estimate, requires
  an image, and still confirms before replacing an existing
  description. Spend-log notes unchanged.
- Retired: 22.6's "Generate from image" auto-redraw
  (generateReferenceImageFromImage) — import is import again, one
  meaning per button. The describe row is gone; describing is now the
  toggle's second direction.
- Aria grammar per card: segments "Generate image from description
  for Mara" / "Generate description from image for Mara", action
  "Generate for Mara", dropdown "Model for Mara". 297 unit tests;
  references e2e suite rewritten for the toggle, green.

## Slice 22.6 — Reference cards generate from images too (2026-08-26, Angel's requests)

- Three changes to the References panel, all from Angel's screenshot:
- The image-model picker leaves its collapsed row (the same trap the
  describe picker escaped in 22.3.2) and sits inline on every card,
  right of the generate buttons; the resolution select and cost hint
  sit on the row below. One choice, shared across cards.
- "Import image" becomes "Generate from image": pick a file, it is
  imported (free, kept as a version) and — when the selected model
  accepts reference images — immediately redrawn by that model, with
  the import riding as the i2i input and style + description as the
  prompt (empty description → "faithfully recreate the subject").
  Model picked later? An accent notice says the import stands and
  what to do next, and the button then redraws the imported active
  image without asking for the file again. New store action
  `generateReferenceImageFromImage`; spend logged as "Reference image
  from image".
- Resolution now defaults to the project's format even for models
  that list RATIO labels: pickResolutionForRatio understands "9:16"
  as proportions (it only parsed pixel sizes, so Angel's vertical
  project landed on the first listed ratio instead of 9:16).
- Per-card aria labels ("Model for Mara images", "Generate Mara from
  image/description", "Reference Mara resolution"). 297 unit tests;
  references e2e suite (incl. a new generate-from-image test) green.

## Slice 22.5 — Resolutions speak human (2026-08-25, Angel's request)

- Angel, after seeing NanoGPT's own picker: pixel sizes alone are hard
  to reason about — show the aspect ratio too. Every resolution
  dropdown (Images workbench, References panel, Animation) now labels
  pixel sizes with their ratio and orientation: "1152x2048 — 9:16
  (Portrait)", "1024x1024 — 1:1 (Square)".
- `resolutionLabel` in lib/resolution.ts: exact friendly ratios shown
  plainly; near-misses marked "≈" (768x1344 is exactly 4:7, shown as
  "≈9:16 (Portrait)" — the ratio a human actually thinks in); bare
  ratio labels like "9:16" gain just "(Portrait)"; tiers like "480p"
  and "auto" pass through untouched. Option VALUES are unchanged —
  only the visible text grew, so pricing lookups and the API payload
  are untouched.
- 296 unit tests; references + images + animation e2e suites green.
- Also confirmed from Angel's live run: 22.4's error surfacing works —
  Grok Imagine answered "Content flagged as potentially sensitive
  (content_policy_violation)" for Mario/Luigi likenesses. That's the
  provider refusing copyrighted characters, not a Kairo bug.

## Slice 22.4 — Ratio labels ride aspect_ratio; 400s explain themselves (2026-08-25, Angel's report)

- Angel's first live i2i generation (Grok Imagine Image, 9:16, Mario +
  Luigi references) died with "NanoGPT request failed (HTTP 400)." —
  an error that names nothing. Two fixes:
- Prime suspect: Grok Imagine lists RATIO labels ("9:16") under its
  "resolutions" — those are aspect ratios, not pixel sizes. The client
  now routes any `\d+:\d+` resolution value into `aspect_ratio` and
  keeps pixel values ("768x1344") in `resolution`. One choke point in
  generateImage covers scene, reference, and generate-all paths.
- The error parser only understood `{message}` bodies; NanoGPT also
  answers `{error: "…"}`, OpenAI-style `{error: {message, code,
param}}`, and `{detail}`. `extractApiErrorMessage` now reads all of
  them and appends the machine hints ("…(invalid_input_references,
  parameter: input_references)"), so the next failure states its
  reason instead of just its status. Server words only — the API key
  can never appear in an error.
- 292 unit tests (4 new: ratio routing + every error shape);
  references + images e2e suites green.

## Slice 22.3.2 — The describe picker moves in with its button (2026-08-25, Angel's critique)

- Two corrections from Angel. First, wording: "vision model" read as a
  model that OUTPUTS images. What the feature uses — and always used —
  is a text model that accepts image input; the copy now says exactly
  that ("a text model that can read images"), including the picker's
  empty-catalog message.
- Second, placement: the panel-level collapsed row died twice (22.3
  invisible, 22.3.1 reachable only through the button). It's gone. The
  model picker now sits inline right beside each card's "Describe from
  image" button — repeated per reference, because that is where it is
  used. The choice is shared: pick a model on Mario's card and Luigi's
  card shows it too. Cost hint sits under the pair.
- Picker aria-labels are per-card ("Model to describe Mara"); e2e
  updated to pin the inline flow. Build, 288 unit tests, references
  suite green.

## Slice 22.3.1 — The describe button finds its own model (2026-08-25, Angel's report)

- Angel imported Mario and Luigi, saw the new "Describe from image"
  button — greyed out — and couldn't find where the vision models
  live. The collapsed "Vision model for describing an image" row was
  invisible in practice, and a disabled button offers no way forward.
- The button is no longer dead: with no vision model picked, clicking
  it expands the collapsed row and opens the vision-model menu itself
  — pick a model, land back on the card, and the button now shows the
  cost and describes on the next click. The hint reads "click to pick
  one" instead of pointing at a row nobody sees.
- If the model catalog reports no vision-capable models at all, the
  picker now says so instead of rendering an empty menu (with a reload
  button) — an empty list looked identical to a broken app.
- e2e updated to pin the click-through: describe with no model →
  vision menu opens → pick → describe runs.

## Slice 22.3 — Describe a reference from its image (2026-08-25, Angel's request)

- The natural flow after 22.2's warnings: you imported a Mario image,
  the app tells you the description is the channel that actually rides
  the prompt — and now a button writes that description for you. "Could
  we add a button to generate a description from the imported image?
  That way users dont need to type it."
- References panel gains a second collapsed picker, "Vision model for
  describing an image" (vision-capable text models only), and every
  reference with an image gains a "Describe from image" button with an
  upfront cost estimate. The vision model looks at the ACTIVE image
  version and writes the descriptor: kind-aware prompts ask for exactly
  what must survive redrawing — a character's face, hair, and clothing
  with colors and materials; a location's architecture, era, and light;
  a style's palette and medium (subject never mentioned, same
  discipline as style-from-image). One paste-ready line of
  comma-separated fragments, 220-token budget.
- The result lands straight in the description textarea (persisted,
  logged in the spend log as "Reference description from image"). If a
  description already exists, a confirm dialog asks before replacing
  it. Errors surface per reference, separate from image-generation
  status.
- New e2e: import image → describe → textarea filled → describe again
  asks first → descriptor persisted. Unit tests pin the kind-aware
  prompt discipline. 288 unit tests green; references suite green.

## Slice 22.2 — References that do nothing now say so (2026-08-25, Angel's report)

- Angel ticked two image-only references (no descriptions) and
  generated with a model that can't take reference images — nothing of
  the references reached the model, and the only warning was a muted
  gray line. References are a TWO-channel mechanism: the description
  rides every prompt verbatim; the image attaches only to
  image-to-image capable models. His setup had both channels empty for
  that generation.
- Three fixes in the Images workbench:
  - Reference chips flag the gap inline: "Mario ✓ · no description".
  - A real alert (accent-colored, role=alert) names every ticked
    reference without a description and explains that an empty one
    adds nothing to the prompt — and that with an image-skipping
    model, nothing of the reference reaches the model at all.
  - The "this model cannot use reference images" note is no longer
    muted whisper-gray: accent color, bold — it's the "why did my
    references do nothing?" trap. The composed-prompt receipt's note
    also turns honest for that case ("this model SKIPS reference
    images — only the words above reach it").
- The "Only show models that can use reference images" filter already
  existed; now the warnings push you toward it. Pinned e2e text
  unchanged (only its styling); references + images suites green.

## Slice 22.1 — One grammar for the recipe (2026-08-25, Angel's critique)

- The recipe mixed three interaction patterns — live textareas, a
  text-plus-Edit-button description, and bare italic preset text —
  and the inconsistency read as scrambled. Now every row speaks one
  language: a small-caps label with a hint, then a box. Editable
  ingredients are ALWAYS-ON textareas that save as you type (the
  scene description dropped its Edit/Save/Cancel modes — same live
  semantics as camera notes and style notes, on both the Images and
  Animation stages); fixed ingredients (preset fragment, guardrails)
  are the same box shape but visibly inert — dashed border, muted
  italic. The camera row joined the same labeled-row grammar.
- The edit-in-place e2e spec was updated to the live-editor flow (the
  Cancel-discards case no longer exists — there are no drafts, edits
  ARE the text, as everywhere else in Kairo).

## Slice 22 — The prompt recipe (2026-08-25, Angel's request)

- No more guessing what the model was told. The Animation stage's
  motion panel is now a full prompt recipe: every ingredient of the
  motion prompt, labeled in the order it is sent, editable where it
  lives — Artistic style (the preset fragment, with a pointer to where
  it's changed), Style notes (editable right there — project-wide, the
  same field as the Images stage), Scene description (the existing
  editor), Camera direction, and Kairo's always-added guardrails —
  followed by "The exact motion prompt, as sent": the composed prompt,
  updating live as you type, with a note that Tweak replaces it
  verbatim.
- The "Carry final frame → scene N+1" button moved from the Clips
  panel into this recipe panel (Angel's call — it belongs with the
  prompt machinery), alongside the carried-in-frame notice it pairs
  with.
- The Images stage's "Scene N — prompt" panel gets the same receipt:
  "The exact image prompt, as sent" — preset + style notes +
  reference descriptors + description + format composition, composed
  live. (Its ingredients were already editable on that stage; the
  composed view was the missing piece.)
- New shared presentation bits in `PromptRecipe.tsx` (RecipeRow,
  RecipeFixedText, ComposedPrompt). One existing spec updated to
  exact-match a description locator the new preview also contains.
- Verified: 285 unit tests, animation + images e2e suites green, and a
  probe with Claymation + custom notes confirming both composed
  prompts contain every ingredient, that editing style notes in the
  Animation panel updates the composed prompt live, and that the carry
  button now sits inside the motion panel.

## Slice 21.3 — The style rides the motion prompt (2026-08-25, Angel's report)

- Angel animated a handoff frame with grok-imagine's
  reference-to-video model: the character survived, the whole painterly
  style vanished. Reason: Kairo's motion prompt was deliberately
  minimal — style lived only in the IMAGE prompt, because start-frame
  image-to-video models inherit the look from the input frame's
  pixels. Reference-to-video models don't: they use the image for
  identity and regenerate the scene from the TEXT — and our text said
  nothing about the style, so the model defaulted to photoreal.
- `buildVideoPrompt` now weaves the project's artistic style (preset
  fragment + style notes) ahead of the scene description in every
  motion prompt. For start-frame models it's redundant confirmation of
  what the pixels already say; for reference models it's the styling
  instruction they were missing. Prompt overrides (Tweak) remain
  verbatim, untouched.
- Verified: 285 unit tests (new weave-order + empty-fragment tests),
  all 9 animation e2e tests green (their project has no style set, so
  their pinned prompts are unchanged).

## Slice 21.2 — The undo lives where the action is (2026-08-25, Angel's call)

- 21.1 put the handoff removal on the Images stage — but the carry
  button lives on the Animation stage, and no user would cross stages
  to find the undo. The carried-in-frame notice ("The active take is a
  carried-in frame…" + "Remove handoff frame") is now one shared
  component, `HandoffTakeNote`, rendered in BOTH places the user meets
  the frame: the Animation workbench's motion panel (same stage as the
  carry button) and the Images stage takes panel. Same confirm, same
  guarantees.
- Verified by probe: carry a frame on the Animation stage, select the
  receiving scene there — the notice and removal work without ever
  leaving the stage.

## Slice 21.1 — The handoff can be taken back (2026-08-25, Angel's report)

- A carried-in frame had no visible way back out: it became the next
  scene's active image and, when that scene had no earlier takes,
  there was nothing to switch to. Now free takes are removable — a new
  `removeFreeSceneImageVersion` action, guarded to `costUsd === null`
  so a PAID take can never be deleted (the founding principle stays
  intact). On the Images stage, when the active take is a handoff
  frame, the takes panel says so ("The active take is a carried-in
  frame…") and offers "Remove handoff frame" behind a confirm: the
  previous take becomes active again, or the scene returns to "no
  image"; the frame's blob is deleted last (crash-safe ordering — an
  orphan file at worst, never a dangling take). The handoff overlay's
  copy now says where the undo lives.
- Verified: 283 unit tests (adds free-removal restore + paid-guard
  suites), and a probe covering both removal cases end to end —
  handoff onto an imageless scene → remove → "no image yet"; handoff
  on top of a generated take → remove → the generated take is active
  again and the note disappears.

## Slice 21 — The handoff: continuation, phase 1 (2026-08-25, Angel's request)

- The next shot can now start exactly where the previous one ended.
  On the Animation stage, a scene with a finished clip (and a scene
  after it) gets a "Carry final frame → scene N+1" button. It opens
  "The handoff": the clip's closing 0.8s is sampled into 8 candidate
  frames — entirely client-side (hidden video + canvas), free, the
  clip never leaves the browser — because the literal last frame is
  often mid-blink or motion-smeared. A cheap gradient-energy score
  suggests the sharpest candidate ("sharpest" badge); the user has
  the final say. The pick is saved as a NEW image version on the next
  scene (model 'handoff-frame', costUsd null — append-only, no cost
  log entry) and becomes its active image, ready to animate from with
  any image-to-video model.
- This is continuation phase 1 (the AI-research memo distilled to its
  practical kernel for a client-side app). Phase 2 — true
  video-reference continuation for capable models — waits on
  confirming what NanoGPT's generate-video endpoint accepts.
- Verified: 281 unit tests (new sharpest-pick suite), build green, and
  an end-to-end probe with a real decodable clip: import → handoff →
  frame strip renders with the suggested badge → save → scene 2 shows
  the frame as its active image, cost log untouched. The undecodable-
  clip path degrades to a clear message with the save disabled
  (exercised incidentally: Playwright's Chromium lacks H.264, so the
  probe's first mp4 hit exactly that path before switching to WebM).

## Slice 20.4 — Four new artistic styles (2026-08-24, Angel's picks)

- The style gallery grows from 16 to 20 presets, each filling a gap
  Angel picked from the proposed set, placed beside its kin:
  - **Felted wool** (after Claymation) — needle-felted miniatures,
    fuzzy fiber texture, the cozy cousin of the handmade family.
  - **Film noir** (after Cinematic still) — hard black-and-white,
    venetian-blind shadows, smoke and rain; the monochrome counterpart
    to the color film look.
  - **Stained glass** (after Ukiyo-e) — jewel-toned glass with bold
    leading, the only preset that glows from within.
  - **Vintage poster** (after Synthwave) — mid-century travel-poster
    gouache, flat confident shapes, screen-print grain.
- The four render as name-tiles until their thumbnails exist: run
  `NANOGPT_API_KEY=your-key node scripts/generate-style-thumbnails.mjs`
  (existing thumbnails are skipped; ~$0.01 per new style) to generate
  them on the shared lighthouse subject per ADR-008.

## Slice 20.3 — Claymation, enriched (2026-08-24, Angel's request)

- Angel asked for a Claymation preset — and one already existed in the
  style gallery, but its fragment was thin next to the reference he
  brought. The prompt fragment now names what makes the look sing:
  "claymation stop-motion film still, hand-molded plasticine
  characters with visible fingerprints and tool marks, handcrafted
  miniature set, warm practical lighting with string-bulb bokeh,
  shallow depth of field, tactile handmade charm". Same id, same
  thumbnail (ADR-008 keeps all thumbnails on the shared lighthouse
  subject so styles stay comparable); projects already using the
  preset simply generate richer takes from now on.

## Slice 20.2 — A muted narration stays muted, everywhere (2026-08-24, Angel's report)

- Angel silenced a take's narration in the Animation workbench (a
  lip-sync clip that carries its own voice), but the premiere player
  still layered the separate narration on top — doubled audio and a
  volume jump. Root cause: the workbench Mute was TRANSIENT component
  state; only auto-detected lip-sync takes (`embedsNarration`) were
  excluded from pairing, and this take didn't carry the flag.
- The mute is now a persisted, per-take choice: a new
  `narrationSilenced` field on the clip version, written by the same
  Mute/Unmute button, and one helper — `clipCarriesOwnAudio` (lip-sync
  flag OR user silencing) — now guards every narration pairing: the
  workbench side player, the fullscreen lightbox, the premiere player,
  and the clips-zip narration files. The status line says where it
  applies: "silenced for this take, here and in the export". Reversible
  any time; survives reload and .kairo round trips.
- Verified: 279 unit tests (new clipCarriesOwnAudio suite), all 9
  animation e2e tests green (the mute test now pins the persistent
  behavior), and a probe walking mute → premiere (no narration element,
  also after reload) → unmute → pairing restored.

## Slice 20 — The Projector K + the suggestion box learns the house choreography (2026-08-24, Angel's picks)

- Kairo has a logo: **the Projector K** (Angel's pick from the ten-
  direction canvas) — a K whose arms are projector beams leaving the
  lens, with the lens as a golden spark. One component
  (`KairoMark.tsx`, strokes in currentColor, spark on the theme
  accent) renders it beside the wordmark in the app navbar; the same
  mark is inlined beside "Kairo" in the landing page's header and
  footer (gold spark in the light palette's #a4712c).
- The browser tab and PWA wear it too: `public/favicon.svg` is the
  mark on the brand-dark rounded tile, and the 192/512 PWA icons were
  re-rendered from it; the manifest's theme/background colors moved
  from the pre-design-pass #101014 to the brand #1d2434, and its
  description no longer says "YouTube videos" (any format now).
- The feedback overlay now behaves exactly like Settings (Angel's
  request): a fullscreen frosted layer UNDER the navbar — the bar
  stays visible on top, the ?-button does the gear's half-turn
  cross-fade into the shared X glyph, and the same button (or Escape)
  closes it. Opening feedback closes settings and vice versa, so the
  two layers never stack. The in-card X from 19.1 is gone — the nav
  X is the one way out, same as Settings.
- Verified: 277 unit tests, theme + apikey e2e suites green (the
  settings-overlay contract they pin is untouched), and a probe
  confirming the navbar stays clickable above the open layer, the
  ?/X flip both ways, and the mutual exclusion.

## Slice 19.1 — Overlay X + the circled question mark (2026-08-24, Angel's request)

- The feedback overlay gets a visible way out: an X button in the
  dialog's top-right — the exact same glyph the Settings gear turns
  into (Angel's call: one X design everywhere). Escape and the veil
  click still close it too.
- The nav button's life buoy became a circled question mark — reads
  more immediately as "support/help".

## Slice 19 — Money back on small screens + the suggestion box (2026-08-24, Angel's request)

- The balance and Spent chips are no longer hidden on small screens —
  hiding them was overkill. Below 860px the center cluster compresses
  (smaller type, tighter gap) but stays centered in the bar; below
  560px it drops to its own centered second row (the header wraps and
  `.nav-middle` leaves its absolute center slot). Verified at 700px and
  480px with overlap checks against the wordmark.
- New nav button (life-buoy icon, right cluster): "Send feedback".
  Angel's call: the project lives on GitHub, so feedback goes there —
  the overlay ("From the audience / Make Kairo better") takes a type
  (Bug report / Suggestion / Question), a one-line summary, and
  optional details, then "Open on GitHub ↗" is a real link to a
  prefilled new-issue page. Nothing is sent from the app itself, and
  only what the user typed goes into the URL. `buildIssueUrl` is pure
  and unit-tested (3 tests); the repo URL is one TODO(angel) constant
  in `src/lib/feedback.ts` (the landing page's GitHub links can share
  it once set).
- Verified: build green, 277 unit tests across 33 files, probe checks
  the composed issue URL (title prefix + encoded body), the disabled
  state on an empty summary, and Escape closing the overlay.

## Slice 18.3 — The phantom four pixels (2026-08-24, Angel's report)

- The crescent STILL showed on small screens after 18.2 — but now the
  measurement told the real story: at full scroll the last segment
  stopped a constant 5px short of the rail's corner, at every width.
  The culprit: the pastel hover ring is a `button::before` box with
  `inset: -4px`, created on EVERY button — including the rail segments
  that are excluded from ever showing it. A hidden absolutely
  positioned box still counts as scrollable overflow, so inside the
  scrolling rail it added 4 phantom pixels past the last segment (plus
  the 1px border): max scroll could never bring Export flush with the
  corner. Only rightward overflow extends scroll range, which is why
  the left corner was always fine. It also made the rail scrollable by
  4px even on big screens where everything fit — the "now on big
  screens too" sighting.
- Fix: the ring-excluded groups (`.rail-segment`, `.reel-frame`,
  `[role='option']`) get `content: none` — no ring, no phantom box.
  Sweep-verified 360→760px: the gap is now exactly the rail's 1px
  border everywhere, and the rail stops being scrollable once its
  labels fit. LESSONS: an invisible pseudo-element still occupies
  scrollable overflow.

## Slice 18.2 — The end segments carry the pill curve themselves (2026-08-24, Angel's report)

- The dark crescent at the rail's corner survived 18.1 — and showed on
  big screens too. Root cause: the segments relied on the rail (an
  `overflow-x: auto` scroll container) to clip their square fills to
  its rounded corners, and that corner clipping is unreliable — the
  active segment's white rectangle poked into the curve, leaving a
  crescent of the rail's dark background visible. Now the first and
  last segments carry the pill radius on their own outer corners
  (`pill 0 0 pill` / `0 pill pill 0`), so their fills hug the curve by
  construction, at every width and scroll position. Middle segments
  stay square. Verified with corner close-ups at 1280/700/420 with
  Export active, and the mirrored Script-at-left-corner case.

## Slice 18.1 — Small-screen rail fills its corner (2026-08-24, Angel's report)

- On small screens the stage rail's segments were `flex: 0 0 auto`
  (content width, scrollable), so at widths where all six labels fit
  with room to spare, the row ended short of the rail's right edge —
  and the rail's dark background peeked past the last segment's white
  active fill in the rounded corner. Now `flex: 1 0 auto`: content
  width stays the floor (the rail still scrolls when labels overflow),
  but segments grow to fill spare width, so the active fill always
  reaches the corner. Verified at 700px (gap ≤ the rail's own 1px
  border) and 360px (scroll behavior intact).

## Slice 18 — Any format: 9:16 to 21:9 (2026-08-24, Angel's request)

- Kairo is no longer a Shorts-only tool. The video format is a project
  choice — five presets: Vertical 9:16 (Shorts · Reels · TikTok),
  Widescreen 16:9 (YouTube · TV), Square 1:1 (feeds), Portrait 4:5
  (Instagram), Cinematic 21:9 (trailers) — picked in the creation form
  and editable any time from the project header. New generations use
  the new format; finished takes keep their shape (ADR-014).
- One source of truth: `domain/formats.ts` maps each format to its
  target ratio, API `aspect_ratio` parameter, CSS aspect, image-prompt
  composition fragment, and script-prompt noun. A `useFormatSpec()`
  hook feeds every frame in the UI — the reel, workbenches, takes,
  batch overlay, references, lightbox thumbs, premiere player, recap
  strip, and the poster wall (posters now wear their project's shape).
- The resolution picker generalized: `pickResolutionForRatio` chooses
  the model's same-orientation size closest to the target ratio, falls
  back to square, then overall-closest, then the aspect parameter —
  verified by request-body probes (a widescreen project asks the image
  API for 1344x768 and submits video jobs at aspect_ratio 16:9, with
  "widescreen 16:9 composition" woven into prompts).
- Script prompts now name the destination per format; the scene
  breakdown prompt is format-agnostic. Legacy projects (and .kairo
  backups) heal `format: 'short'` → 'vertical' on load — no schema
  bump, old backups import cleanly.
- Landing page and README updated: "finished video in any format —
  9:16 to 21:9" replaces the vertical-Short framing.
- Verified: build green, 274 unit tests across 32 files (new
  formats/normalize suite + ratio-picker suite), 23 touched e2e tests
  green (projects, scenes, images, references, animation, export,
  script), plus a full widescreen pipeline probe with screenshots.

## Slice 17.2 — The balcony seat: fullscreen premiere (2026-08-23, Angel's request)

- The premiere can now be watched fullscreen: a circular expand button
  sits in the frame's top-right corner, and the whole frame — not just
  the video — goes fullscreen, so the play/pause overlay keeps working
  edge to edge. The house lights go down (black backdrop, clip
  letterboxed with object-fit contain), the progress strip and the
  "Scene N of M" caption move to the bottom of the screen like a
  subtitle band, and the finished line becomes just "— encore?" (the
  download buttons aren't visible from the balcony). The same button
  (now a collapse glyph) or Escape comes back; the UI mirrors the
  browser's own fullscreen state via `fullscreenchange`, so however
  fullscreen ends, the frame is always right.
- Verified by probe: the frame is the fullscreen element at exactly
  viewport size with a black backdrop, play/pause works inside,
  exiting restores the normal card intact. Headless-Escape note: the
  probe exits via the button because synthesized Escape never reaches
  the browser's fullscreen handler — real Escape is native behavior.

## Slice 17.1 — The credits become a porthole (2026-08-23, Angel's report)

- On a real project the cast list is long (every model that ever
  charged gets a line), and the credits card grew to fit ALL of it —
  which also stretched the screening card beside it, pushing "The
  final cut" and the download buttons a full page down. Root cause:
  the rolling track sat in normal flow, so its content height drove
  the card's intrinsic height (`height: 16rem` lost to the flex
  sizing). The track is now absolutely positioned inside the roll —
  out of flow, so no cast length can ever grow the card — and the
  roll just fills the screening row's height (16rem floor). Verified
  by injecting 120 extra credit lines in a probe: card height moved
  0px, and the recap strip stays within one screen of the title card.
- Bonus: hovering the credits pauses the roll, so a long cast can
  actually be read.

## Slice 17 — Premiere night: the Export stage warms up (2026-08-23, Angel's request)

- The Export stage was a file manager — buttons and readiness math,
  nothing that honored the finished work. It's now premiere night:
  - **Title card**: perforation strips frame a "Premiere night"
    eyebrow, the project's title in lights, and warm readiness copy
    ("That's a wrap — 1 of 1 scene has a finished clip" when complete,
    "Nearly there —" with an encouraging note about premiering what's
    ready when not), plus a one-line production tally (scenes ·
    generations · made for $X). The e2e-pinned "Export readiness"
    label and its "N of N scene(s) has a finished clip" phrasing are
    unchanged.
  - **Tonight's screening**: a premiere player that screens the
    finished takes in scene order — active clip per scene with its
    narration synced alongside (skipped when the clip embeds it),
    custom play/pause overlay, a FilmProgress strip tracking the whole
    program, a "Scene N of M" caption with the scene's excerpt, and an
    encore state when the reel ends.
  - **The credits**: a slowly rolling credits card built from the real
    cost log — every model that actually charged for work, grouped by
    department (Written with / Narrated by / Cinematography / Motion
    by), closing with "Directed and produced by you". The content is
    duplicated and the track slides −50% so the loop is seamless; a
    top/bottom mask fades the edges. `creditsByKind` is exported and
    unit-tested (3 tests). Reduced motion leaves a static, readable
    card (no fill-mode, so the collapsed animation rests at the top).
  - **The final cut**: a frame-by-frame recap strip of every scene's
    active image; scenes still missing a clip render dimmed with a
    dashed border.
  - **Take it home**: the three download cards, retitled as keepsakes —
    "Take it to the edit" (clips zip), "The one-file premiere"
    (stitched draft), "Keep the negatives" (project backup). Button
    names, busy progress bars, and all download logic are unchanged.
- Verified: build green, 263 unit tests across 31 files, both
  export.spec.ts e2e tests pass untouched, and a Playwright probe
  walked the full mocked pipeline to Export, asserted the credits
  track really animates (computed transform advances, mask present)
  with motion on, exercised play/pause, and screenshotted both themes.

## Slice 16.3.2 — Page transitions between landing and app removed (2026-08-23, Angel's call)

- The landing ⇄ app transitions (16.3's browser view transition and
  16.3.1's hand-animated direction) never earned their keep — the
  asymmetric mechanics made the crossing feel worse, not smoother.
  Both are gone: no @view-transition opt-ins, no exit/entrance
  animations, plain instant navigation both ways. The landing page's
  own on-page motion (ribbon flow, hero rise, scroll reveals) and all
  in-app motion are untouched.

## Slice 16.3.1 — The landing→app direction becomes visible (2026-08-23, Angel's report)

- Angel saw the transition entering the landing page but not entering
  the app. Root cause: the app is an SPA whose first paint is an empty
  shell, so the browser-level view transition dutifully slid in a
  featureless rectangle — invisible. That direction is now
  hand-animated in three parts: the landing page plays a 240ms
  exposure-dip exit on CTA clicks before navigating (plain left-clicks
  only — new-tab clicks pass through), it skips the browser transition
  toward the app (pageswap), and the app plays its film-advance
  entrance on #root once React has actually painted (detected via
  referrer, class removed after the run so no transform lingers).
- App → landing keeps the browser-level cross-document transition from
  16.3 — that direction was already visible since the landing paints
  instantly. Reduced-motion and the Motion setting silence all of it.
- Verified deterministically: exit class + dimmed mid-exit screenshot,
  entrance animation running on arrival with the right referrer.

## Slice 16.3 — Crossing between landing and app is a film advance (2026-08-23, Angel's request)

- Navigating landing ⇄ app now plays a cross-document view transition
  in the house style: the outgoing page dips its exposure (dims and
  darkens slightly) while the incoming one slides into the gate from
  the right on the film easing. Pure CSS (`@view-transition` opt-in in
  both documents); browsers without support simply navigate.
- Silenced by the Motion setting ('off'), and by the OS reduced-motion
  preference unless Motion is 'Always on' — same policy as every other
  animation. Verified by filming the crossing both ways and checking
  both documents' opt-in rules; e2e (reduced-motion path) unaffected.

## Slice 16.2 — The wordmark leads home (2026-08-23, Angel's request)

- The "Kairo" wordmark in the app's navbar is now a real link to the
  landing page (`/landing.html`) — middle-click and new-tab work, with
  a subtle opacity dip on hover. When the logo mark exists it will join
  the same link.
- The theme e2e used a click on that heading as its click-outside
  target; it now clicks an inert heading instead (the wordmark would
  navigate away). 260 unit tests, theme + smoke e2e green.

## Slice 16.1 — The spend breakdown becomes a production ledger (2026-08-23, Angel's request)

- The spend overlay's flat text list grew into a ledger worthy of the
  landing page's receipt: an eyebrow-titled header with the total as a
  big tabular headline (ticking in on change), a per-kind composition
  bar showing where the money went, legend tiles with per-kind totals
  and counts, dashed-rule receipt rows (kind dot, note, model,
  timestamp, estimate-vs-actual, bold right-aligned figure), and a
  one-line promise footer.
- The bar's series colors were chosen by procedure, not taste: the
  soft UI pastels FAILED the palette validator on every check as data
  colors (too pale, adjacent pairs indistinguishable), so the bar
  wears validator-passing jewel steps — one hue per kind in both
  themes (text rose, audio gold, image blue, video green; dark mode
  gets its own gold step), fixed order, 2px surface gaps, identity
  carried by dot + label + number, never color alone.
- The e2e text contract ("Spent $X", "N generations", "actual $X")
  is preserved verbatim; script + scenes + audio e2e green, 260 unit
  tests green, verified by dark + light screenshots.

## Slice 16 — The Pastel River landing page (2026-08-23, Angel's pick from 10 directions)

- Kairo has a marketing page: `/landing.html`, a second Vite entry
  beside the app. The chosen "Pastel River" direction from the design
  canvas, built for real: flowing pastel ribbon hero (the app's
  seamless two-tile gradient slide), staggered hero reveal with a
  pastel underline sweep, three promise cards that develop in and
  float, the six-stage pipeline with sequentially glowing pastel
  halos, the priced-in-the-open section with a labeled sample receipt,
  and the app's rotating jewel-tone ring on the primary CTA.
- Real behavior on the real page: scroll-triggered reveals via
  IntersectionObserver (play once per section), gentle rAF parallax on
  the hero ribbon, full reduced-motion collapse, responsive to phone
  width with no sideways scroll (`overflow-x: clip` — the ribbon
  bleeds past both edges by design), SEO/OG meta, self-contained CSS
  and JS.
- All copy is product truth: free, open source, BYOK NanoGPT, exact
  prices, resume-after-close, export without watermark. The two GitHub
  links are `href="#"` with TODO comments until the repository URL is
  filled in; the receipt is explicitly labeled a sample.
- Verified by desktop + mobile screenshots (hero, pipeline mid-glow,
  receipt), sideways-scroll pinned at 0, smoke e2e green (the app
  entry and PWA shell are untouched). 260 unit tests green.

## Slice 15.18.1 — The hover ring earns its light-mode wardrobe (2026-08-23, Angel's request)

- The ring's soft pastels all but vanished on light palettes. Its six
  gradient stops are now theme tokens (`--ring-1..6`): dark palettes
  keep the original pastels, light palettes swap in deeper jewel tones
  (rose, amber, gold, green, blue, violet) via the existing
  `data-mode='light'` hook. Buttons and selects both read from the same
  tokens, so the two ring implementations can never drift apart.

## Slice 15.18 — Kairo fits in one hand (2026-08-23, Angel's request)

- Responsive pass down to phone width (375px), one main breakpoint at
  720px plus a 1100px mid-stop for the workbenches. Kairo MAKES phone
  videos; now it can be driven from one. Zero horizontal overflow at
  375 and 768 across all six stages (was 58px of page-wide sideways
  scroll on Animation).
- The three-panel workbenches (Audio, Images, Animation) moved their
  grid from inline styles to a shared `.workbench-grid` class: three
  columns on desktop, two on mid widths, a single column on phones —
  with `min-width: 0` on panels so long selects can't force the page
  wider.
- The stage rail scrolls sideways on phones (labels stay readable at
  full size) instead of crushing six segments into 375px; `main` and
  `header` padding moved to the stylesheet so media queries can tighten
  them.
- The model-picker dialog stacks its filters sidebar under the list on
  phones (the stacked rows are kept at natural size and the grid
  scrolls — compressed rows painted the list footer over the sidebar).
- Scenes and Export grids use `minmax(min(Nrem, 100%), 1fr)` so their
  card minimums can never exceed the viewport; batch-overlay rows wrap.
- Verified by full-stage screenshot audits at 375px and 768px; 260 unit
  tests and smoke + images + animation e2e green at desktop width.

## Slice 15.17.12 — The lingering ghost ring exorcised (2026-08-23, Angel's report)

- Moving the cursor off a button could leave a stale fragment of the
  pastel ring painted next to it. The ring only faded to opacity 0, so
  its composited mask layer (animated via @property) stayed alive — and
  real-GPU Chrome could keep its last frame on screen. The ring is now
  also visibility-gated: hidden the instant the fade completes, which
  tears the layer down so nothing can go stale. Verified: hover shows
  the ring, unhover returns the page pixel-identical to idle.

## Slice 15.17.11 — One chevron to rule every dropdown (2026-08-23, Angel's catch)

- Native selects drew the browser's own arrow crammed against the
  border, visibly different from the model-picker buttons' chevron.
  Selects now suppress the UA arrow (`appearance: none`) and draw the
  exact same 9x6 chevron at the exact same var(--space-4) inset, as a
  themed data-URI background layer (light glyph on dark palettes, dark
  on light — data URIs can't use currentColor). The hover ring's
  background layers gained the chevron on top so it survives hover.

## Slice 15.17.10 — Selects join the button family (2026-08-23, Angel's catch)

- Dropdown selects (resolution, duration, speed, batch rows, motion
  preference — all of them) still wore the squarer field radius and
  missed the ring pass. They now dress like the buttons they behave
  like: pill radius, and the rotating pastel ring on hover. A <select>
  is a replaced element (no ::before), so the ring is painted through
  its own border — surface tint over an opaque page-color backing over
  the conic gradient, clipped padding-box/padding-box/border-box (the
  backing matters: the surface tint is translucent, and without it the
  gradient bled through the middle).
- Text inputs and textareas stay soft rectangles on purpose: they hold
  content; selects trigger it.

## Slice 15.17.9 — The pastel ring becomes THE hover language (2026-08-23, Angel's request)

- Every standalone button now lights the rotating pastel ring on hover
  instead of lifting — one generalized rule (`button::before` ring +
  hover activation) replaces the per-navbar-icon version. The ring
  inherits each button's radius, so pills, circles (the ? help button)
  and rounded buttons all wear it correctly.
- The primary-button light-sweep sheen retired (the ring is the hover
  flair now), which also freed primary buttons of the overflow:hidden
  that would have clipped the ring. Press physics stay.
- Exclusions stay quiet on purpose: menu option rows, the stage-rail
  segments (label-grow + tint from 15.17.7) and reel frames (their
  lift is part of the film identity).

## Slice 15.17.8 — Navbar icons: pastel ring hover, a better gear that spins into an X (2026-08-23, Angel's request)

- The two round navbar buttons (palette, settings) dropped the lift +
  press-squash hover for a thin rotating pastel ring — the same pastel
  river as the progress strips, drawn as a conic gradient masked to a
  2px band circling just outside the button while hovered.
- The gear icon was redrawn (eight rounded teeth around a ring with a
  hub — the old spiky polygon read as a splat), and toggling settings
  now spins the icon a half turn while it cross-fades into the X; the
  close click spins it back into the gear.

## Slice 15.17.7 — Rail segments hover in place (2026-08-23, Angel's request)

- Stage-rail segments dropped the global button hover (the 1px lift
  read as a segment jumping out of the continuous pill). Hovering now
  grows the label + icon a touch (scale 1.07 on an inner wrapper, so
  the segment box never moves) and tints the cell with a subtle
  text-color wash that adapts to the theme; pressing dips the label.
  The inline background switched from the `background` shorthand to
  `backgroundColor` so the CSS tint overlay can layer on top.

## Slice 15.17.6 — Progress strips become a pastel river (2026-08-23, Angel's request)

- The progress bars traded their dark marching perforations for a slow
  river of pastel color (rose → peach → butter → mint → sky → lilac)
  flowing through the strip while work runs. Indeterminate work floods
  the whole strip; determinate work grows the pastel "developed" length
  left-to-right over a faint perforation texture on the unexposed
  remainder. The gradient tiles seamlessly (same hue at both ends,
  image exactly 2x the strip) so the flow never visibly loops.
- Verified by screenshot in both modes on the dark theme; reduced
  motion still freezes the flow.

## Slice 15.17.5 — The clip player sits centered in its panel (2026-08-23, Angel's request)

- The Clips panel's video hugged the left edge, leaving a lopsided
  blank right half; it now centers horizontally (verified pixel-equal
  side gaps). Takes thumbnails and the narration player keep their
  full-width rows.

## Slice 15.17.4 — The reel stops bopping the page (2026-08-23, Angel's report)

- Selecting a frame in "The reel" grew the panel itself (the selected
  frame is wider, and at 9:16 wider means taller), shoving everything
  around it up and down on every click. The strip now reserves the
  selected-frame height from the start (`frameHeight` on `ReelShell`,
  passed by Images and Animation), so frames grow into already-reserved
  space and the panel never changes size. Verified: panel height and the
  position of neighboring boxes are pixel-identical across selections.

## Slice 15.17.3 — Images stage opens on its reel (2026-08-23, Angel's request)

- The Artistic style box moved below "The reel" on the Images stage, so
  Images and Animation both open on their reel at exactly the same
  height — switching between the two stages no longer jumps the layout.
  Verified: both reels start at the same Y coordinate.

## Slice 15.17.2 — Motion you can actually see; the transport deck glides (2026-08-23, Angel's feedback)

- The transport deck now travels instead of teleporting: the playhead
  needle and its pennant glide along the tape between stages, the gold
  fill spools behind them on the same clock, the stop dots light up as
  the needle passes, and the rail's lit segment cross-fades to the next
  one instead of blinking. All on the one `--ease-film` curve at
  `--t-slow`, so needle, tape, dots and rail arrive together.
- The animations were tuned to be legible, not subliminal: stage
  advances travel 52px (was 18px) over 550ms (was 260ms), dialogs
  settle from scale 0.94 / 14px below (was 0.965 / 6px), developing
  takes start at 16px blur, number ticks rise from 0.8em, and the
  shared `--t-med`/`--t-slow` stops moved to 300ms/550ms.
- Verified frame-by-frame from a recorded walkthrough: mid-transition
  frames show the needle between stops with the fill trailing and the
  rail segment cross-fading. 260 unit tests, smoke + theme e2e green
  (the suite runs reduced-motion, so timing tweaks cost it nothing).

## Slice 15.17.1 — Motion visible, overlays whole again (2026-08-23, Angel's report)

- Angel saw NO animations at all, and the lightbox veil stopped covering
  the screen (outside-click close dead, only Escape worked). One root
  cause, two symptoms: macOS "Reduce motion" was on, so every animation
  collapsed to 0.01ms per the a11y block — silently, with nothing in the
  UI saying why — while the stage-entrance animation's `fill-mode: both`
  kept a `transform` pinned on the stage wrapper forever. A transformed
  ancestor traps `position: fixed`, and Lightbox + ConfirmDialog were
  the only overlays NOT portaled to `<body>` — their "fullscreen" veils
  became stage-sized.
- Fixes: Lightbox and ConfirmDialog now portal to `<body>` like every
  other overlay (ConfirmDialog also gained the missing `zIndex`); the
  stage entrance runs with NO fill-mode so no transform outlives it; and
  a new **Motion** setting (Settings → Motion) offers Follow system /
  Always on / Off — with a note, when the OS asks for reduced motion,
  explaining that Kairo is honoring it. The choice rides a root
  `data-motion` attribute the CSS guards on.
- e2e now runs on the reduced-motion path (`contextOptions` in the
  Playwright config): entrance animations were adding ~300ms of
  "element is not stable" waiting to every click and tipping long tests
  over their budgets — the suite tests logic; the motion is reviewed
  visually.
- Tests: 260 unit (MotionSettings hint + persistence), images + script +
  scenes + audio + animation e2e green; a Playwright probe verified the
  veil at exactly viewport size, outside-click closing, and real
  animation durations under OS reduce-motion with the override on.

## Slice 15.17 — The projectionist's cut: motion everywhere (2026-08-23, Angel's request)

- One motion identity (ADR-013) built from the app's own film metaphor,
  as tokens + utility classes in `index.css`: an `--ease-film` curve and
  three duration tokens drive every animation in the app.
- Stage changes are direction-aware film advances: moving forward in the
  pipeline slides the incoming stage in from the right with a brief
  exposure lift; going back rewinds from the left.
- New `FilmProgress` sprocket strip at EVERY long operation: marching
  perforations while work runs, an accent "exposed" fill that grows for
  determinate work. Wired into script/scenes generation, single + batch
  narration, voice preview preloading, single + batch image generation,
  per-scene animation, batch measuring, and all three export builds.
- Overlays warm up like a projector lamp (veil fade + dialog focus
  scale): all pickers, spend breakdown, confirm dialogs, lightbox,
  camera help, batch overlay, settings.
- Fresh takes develop like prints — blurred, washed and overbright for
  half a second, then snapping into focus (workbench images, clips,
  lightbox paging).
- Buttons gained press physics (hover lift, 60ms compress on press) and
  primary buttons a light-sweep sheen; reel frames glide between sizes
  and lift under the cursor; balance and spend totals tick in like
  counter wheels.
- `prefers-reduced-motion` collapses the whole language to near-instant
  state changes.
- Hardening: `pollVideoJobTick` no longer shares the terminal "stop
  polling forever" path between a transient missing API key and a
  closed project — a paid job's poller now retries through the
  transient case.
- Tests: 257 unit (FilmProgress semantics added), audio + animation e2e
  green; the interrupted-job test got a 60s budget (it runs the whole
  pipeline twice and no longer fit 30s).

## Slice 15.16.3 — Lip-sync clips don't double the narration (2026-08-22, from Angel's catch)

- A lip-sync clip carries the narration IN ITS OWN AUDIO TRACK — Angel's
  first live S2V take proved it — so every narration-pairing feature
  must stand down for such takes. New `embedsNarration` flag rides the
  generation job (surviving reloads and resumed polls) onto the
  collected AssetVersion, and then: the clips panel swaps the side
  player + Mute for a one-line "embedded in this lip-sync clip" note
  (the audio element stays mounted, hidden and muted — it is also how
  narration length is measured); the video sync handlers stand down;
  the lightbox plays the clip alone; and the export zip skips that
  scene's separate narration file (the voice ships inside scene-NN
  itself — a duplicate file invites doubled audio in the edit).
- Per-take, not per-scene: switching back to a regular take of the same
  scene brings the side player straight back.
- Tests: 254 unit (flag rides job → version; export skips exactly the
  embedded scene's narration file, keeps clip-less scenes' voice);
  lip-sync e2e extended (note shown, no Mute button offered).

## Slice 15.16.2 — Lip-sync button fixed: it no longer needs a main model (2026-08-22, Angel's report)

- "Lip-sync narration" did nothing when clicked: the confirm dialog was
  rendered behind a `model !== null` gate — the MAIN Animate model —
  but the lip-sync flow has its own model and needs no main one. The
  gate now checks the model the flow actually uses. New e2e regression
  test drives the exact reported path: no main model chosen, lip-sync
  model picked, dialog appears, submission carries `data:audio` and no
  duration.
- Enabler: the e2e TTS mock now returns a REAL tiny WAV instead of fake
  bytes — the app measures narration length from the audio itself
  (duration hints, lip-sync gating), so undecodable mock audio left
  those features dormant and untestable. audio+animation suites re-run
  green (12 e2e).

## Slice 15.16.1 — Lip-sync picker explains each model (2026-08-22, from Angel's question)

- Angel counted 14 models in the lip-sync menu and asked whether they
  all really lip-sync. Honest answer: they all DECLARE image+audio
  input, but the family splits into dedicated avatar/talking-head
  models (Wan S2V, Omni Human, LongCat, MagiHuman, VEED Fabric) and
  general models that use audio more loosely (Music Video Generator
  cuts to the beat; Seedance/LTX treat it as guidance). The listing has
  no lip_sync flag to tell them apart — but it has each model's own
  DESCRIPTION, so the lip-sync menu now shows it on every row
  (two-line clamp): the provider's own words, not our guesses.
- Tests: 253 unit (lip-sync menu shows only capable models, with
  descriptions and per-second badges).
- VERIFIED by Angel against NanoGPT's own model pages (2026-08-22): all
  14 models the filter admits specialize in lip-sync. The
  `image_to_video` + `audio_input` capability pair is a reliable
  lip-sync signal in the listing — no curation set needed.

## Slice 15.16 — Lip-sync narration (2026-08-22, Angel's feature pick)

- The Animation workbench gains a **Lip-sync** section: pick a lip-sync
  model and Kairo turns the scene's active image into a talking clip
  driven by the scene's active narration — `imageDataUrl` +
  `audioDataUrl` + `audioDuration` (the documented avatar/lipsync
  convention), NO duration field: the narration defines the length,
  which is the whole point. The requirement is stated where the button
  lives: works when the image shows a person with a visible face; the
  clip length follows the narration (shown in seconds); the button
  stays disabled until the scene has both an image and a narration.
- Model detection is honest (extractLipSync): `image_to_video` +
  `audio_input` from the listing — wan-wavespeed-s2v, longcat-avatar
  1.0/1.5, bytedance omni-human — EXCLUDING models that want public
  audio URLs (longcat multi: a client-side app has none to give),
  video-input lipsync (kling a2v), and self-voicing t2v (kling t2v).
- Cost honesty per second: the lip-sync picker shows per-SECOND rates
  ("$0.04–$0.08/s by resolution"), and the workbench line computes
  ≈cost for THIS narration at the cheapest resolution before the
  confirm dialog charges. Same job pipeline as every clip — polling,
  crash recovery, history, lightbox, export all just work.
- Polish: with no model chosen the Duration/Resolution rows show "—"
  instead of a misleading "fixed by model" (15.15 blind spot).
- Tests: 252 unit (detection matrix from the live dump; submission
  carries typed base64 audio + duration and no length fields; honest
  no-narration failure before any charge).

## Slice 15.15 — No more controls that lie (2026-08-22, from Angel's catch)

- Some models advertise NO duration parameter (Wan 2.2 Turbo: every clip
  is a fixed length) — yet Kairo showed a generic 5/8/10s select that
  did literally nothing. The LESSONS rule ("an unadvertised parameter is
  an ignored parameter") now applies to a control's EXISTENCE, not just
  its values: an empty durations/resolutions listing renders "fixed by
  model" instead of a select, and the request carries no such field at
  all. Duration is nullable through the whole pipeline — workbench,
  batch overlay rows ("fixed length"), store, API client.
- The old fallback note ("if it cannot make a Ns clip…") was rewritten —
  it described behavior that no longer exists.
- ROADMAP: S2V lip-sync candidate slice recorded (Wan 2.2 S2V takes
  image + audio — Kairo already holds both per scene); until built,
  input-requiring models are the next honesty gap to close in the
  picker, pending the S2V listing dump.
- Tests: 249 unit (fixed-length model: no select, null duration
  submitted, no duration/num_frames fields in the request).

## Slice 15.14 — Frame-based video models speak seconds (2026-08-22, from Angel's field find)

- Angel asked Wan 2.1 for an 8s clip and got 5s: the model takes NO
  duration parameter — it takes `num_frames` (81–100) and
  `frames_per_second` (5–24), and a duration ask is silently ignored
  (defaults: 81 @ 16fps ≈ 5.1s). Kairo now detects frame-based models
  from the listing and keeps everything in seconds: their duration
  picker offers the ACHIEVABLE second-targets (81/24≈3.4s up to
  100/5=20s), and at submission the target is translated into the
  cheapest frame plan that reaches it — fewest frames first (frames
  drive Wan's +25% surcharge), so 8s becomes 81 frames @ 10 fps, not
  96 @ 12. A note under the picker shows the exact plan and the honest
  tradeoff (lower fps = choppier motion). Narration auto-fit and the
  batch overlay work unchanged, since they consume the same durations.
- Range parsing handles all three shapes seen live: clean `min`/`max`
  fields (Wan 2.2 5b), preset options only (Wan 2.1 frames), and a
  range living ONLY in the description text — "(5-24)" (Wan 2.1 fps).
- Second fix from the same dump: newer models (wan-wavespeed-25/26,
  wan-25-fast, hunyuan-video-15…) advertise duration/resolution in a
  structured `parameters` select schema Kairo didn't read — it offered
  wan-25-fast an 8s it doesn't have. Both schemas now feed the pickers,
  so models always show their REAL options.
- Tests: 247 unit (frame-plan solver incl. edge clamps; achievable
  targets; the real Wan 2.1 listing shape; frames+fps submitted with
  no duration).

## Slice 15.13 — Prompt stitching dedupes periods; camera-direction guidance (2026-08-22, from Angel's field find)

- Angel spotted "..distance.. Camera: No pan, no camera zoom.." in a
  real prompt: the builders join fragments with ". " themselves, so any
  user text ending in a period doubled it. `unterminated()` now strips
  ONE trailing period from user-written fragments (visual description,
  camera notes, style notes, reference descriptors) before joining —
  deliberate "..." and "…" endings are preserved.
- The same clip taught a prompting lesson: video models handle
  negations badly ("No zoom" often ADDS zoom — the concept gets
  mentioned, so it gets generated) and lean toward motion by training
  bias. A "?" beside the Camera direction field now opens a short guide
  ("Directing the camera") teaching positive phrasing — "Static shot.
  Fixed camera locked on a tripod. The framing never changes." — and
  the field's placeholder nudges the same style. (The new help
  button's aria-label collided with the textarea's by substring —
  exact-match in the spec, per the standing LESSONS rule.)
- Tests: 240 unit (period dedupe incl. ellipsis preservation, image
  prompt fragments covered); the animate-scene e2e re-run green.

## Slice 15.12 — Batch animation gets a pre-flight overlay (2026-08-22, from Angel's feedback)

- "Animate X remaining scenes" no longer fires a blind confirm — it opens
  an overlay listing every pending scene as a row: thumbnail of the still
  that will be animated, the scene's text, its narration length ("♪
  narration 6.4s" / "no narration"), and that row's OWN model and
  duration selects. Durations arrive pre-fitted per scene (15.11's rule,
  now visible and editable); switching a row's model re-fits its duration
  within the new model's options and picks the cheapest valid resolution
  for it. One Submit sends the lot, sequentially, per-scene progress on
  the frames as before.
- The footer sums the advertised price ranges of everything about to be
  submitted ("≈$1.44–$3.60 total, charged at submission") — cost honesty
  at batch scale.
- `generateAllVideos` left the store (the overlay drives per-scene
  submissions directly); the 15.11 fit logic lives on in the overlay's
  defaults via the same pure `pickClipDuration`.
- Tests: 237 unit (overlay: pre-fit rows, per-row override + re-fit,
  submitted configs, summed estimate).

## Slice 15.11 — Animate-all fits each clip to its narration (2026-08-22, from Angel's catch)

- "Animate X remaining scenes" used the ONE selected duration for every
  scene, so any scene with a longer narration got a clipped video the
  user had to redo by hand — which made the button self-defeating. Now
  the batch flow measures each scene's active narration (WebAudio
  decode) and picks the SMALLEST duration the model offers that covers
  it; the model's longest when nothing does (the clips panel's mismatch
  warning still tells the truth then); the selected duration when a
  scene has no narration, the length can't be measured, or the model
  lists no duration options. The confirm dialog says exactly this
  before charging.
- Single-scene animation stays manual — the "narration runs Xs" hint
  next to the Duration picker already informs that choice.
- Tests: 237 unit (pure picker: cover/exact-fit/cap/fallbacks; store
  test proving a 6.4s narration turns the selected 5s into the model's
  8s at submission).

## Slice 15.10 — Narration speed control (2026-08-22, from Angel's feedback)

- Speed-capable models get a **Speed slider** in the Narrate panel with a
  live ×-readout; everything else shows "Speed fixed by model", exactly
  like NanoGPT's own UI. The listing carries no speed field, so the
  capability is a curated table with each PROVIDER's real range
  (docs-verified): Kokoro 0.5–2×, OpenAI tts-1/tts-1-hd 0.25–4×,
  ElevenLabs Turbo V2.5 0.7–1.2×. gpt-4o-mini-tts ignores the parameter
  server-side, so it stays fixed-pace on purpose.
- The chosen speed flows into single-scene narration, narrate-all, and
  history regeneration; the 1× default is omitted from requests, and
  the speed resets to 1× on model switch. Voice previews always play at
  1× (one cache entry per voice, and a preview is about the voice, not
  the pace). Price is unaffected — billing stays per character.
- Tests: 233 unit (range table; speed reaches the request body; 1×
  omitted).

## Slice 15.9.4 — VibeVoice hidden from the catalog (2026-08-22, Angel's call)

- `microsoft/vibevoice` is excluded from the TTS listing
  (`BROKEN_TTS_MODEL_IDS` in the API client): NanoGPT charges $0.15
  flat and then kills the run instantly, so offering it would only
  sell guaranteed failures. The exclusion is one documented line —
  re-test and remove it when NanoGPT fixes their side.

## Slice 15.9.3 — Charged-at-submission bookkeeping; VibeVoice diagnosed (2026-08-22, from Angel's field test)

- Queue-based TTS models charge AT SUBMISSION (`charged: true` in the
  envelope). Until now a run that was charged and THEN failed left no
  trace in the spend log — money gone, books blind. Both audio paths
  (voice previews and scene narrations) now record the charge with the
  envelope's authoritative `cost` when a queued run fails, with an
  explicit note; the preview error also says the failed run was billed.
  Successful queued runs likewise book the envelope's cost, not our
  computed one.
- VibeVoice, root-caused with Angel's probe: NanoGPT accepts the job,
  charges $0.15, and the run then dies instantly server-side —
  `{"status":"error","terminal":true}` on the first poll. That is a
  provider-side failure (worth reporting to NanoGPT); Kairo now honors
  the `terminal: true` flag (stop polling whatever the status string
  says), surfaces the API's error, and books the charge. Every attempt
  costs $0.15 flat, so the honest move is the error message, not a
  retry loop.
- The finished-audio download now names the CORS wall when a storage
  host blocks browser reads, instead of a bare "Failed to fetch".
- Tests: 230 unit (terminal flag; failed-queued-run booking with the
  envelope cost).

## Slice 15.9.2 — Async TTS models work: poll the queue like the video pipeline (2026-08-22, from Angel's field test)

- Angel's model-by-model test + a console probe cracked it: the models
  that never played (ElevenLabs, VibeVoice, Omnivoice, Qwen-3-TTS,
  ByteDance Seed Audio) are QUEUE-BASED — `/v1/audio/speech` answers
  them with `{"status":"pending","runId",…,"charged":true}` instead of
  audio, and Kairo was caching that receipt as the "preview". Now
  `generateSpeech` detects the envelope and polls `GET /tts/status`
  (2s interval, 5-minute cap) until `completed`, then downloads the
  `audioUrl` — resolved against the NanoGPT origin if relative (Grok
  lesson), key attached ONLY same-origin (the key is sacred). Previews
  and full scene narrations both gain this for free.
- Honest failure paths (was: a generic line and silence): the API's own
  error message surfaces in the voice menu; when a provider bills a call
  but returns unplayable bytes, the spend is logged anyway (honest books)
  and the junk is NOT cached; previews are decode-verified
  (`OfflineAudioContext.decodeAudioData`) before caching; and cached
  junk from before the fix — Angel's paid ByteDance "previews" were
  167-byte pending receipts — is evicted on the next ▶ and regenerated.
- Tests: 228 unit (queue poll → download with key gating; billed-but-
  unplayable books; pending-receipt eviction; real-error surfacing);
  audio e2e re-run green.

## Slice 15.9.1 — Silent previews fixed: trust the bytes, not the headers (2026-08-22, from Angel's feedback)

- Angel found voice previews loading but never playing on SOME models —
  the tell that certain providers behind `/v1/audio/speech` ignore
  `response_format: 'mp3'` and return WAV/OGG bytes (or a JSON envelope
  of base64 audio) under a lying Content-Type, which makes `<audio>`
  pick the wrong demuxer and fail in silence. New `normalizeAudioBlob`
  sniffs the real container from magic bytes (mp3/wav/ogg/flac/m4a),
  unwraps base64-JSON envelopes, and re-types the blob — applied to
  voice previews AND scene narrations, plus on preview cache reads
  (healing OPFS's stripped MIME and any junk cached before the fix).
  Playback failures now surface as messages, never silence.
- Voice menu caching (Angel's suggestion): already-cached previews are
  detected when the menu opens and marked on their ▶ (accent ring —
  "plays instantly, free"), decoded audio stays in memory for instant
  replay, and a **Load all ($X)** button fetches every missing preview
  for the current model — the exact total is stated on the button, spend
  logged per voice as always, nothing auto-downloads without a click
  (cost honesty: 22 ElevenLabs voices would be real money).
- Tests: 225 unit (sniffer corpus: WAV-labeled-mp3, stripped MIME, JSON
  envelope, error JSON, unknown binary); audio e2e re-run green.

## Slice 15.9 — Live TTS catalog, rich narration menu, voice previews (2026-08-22, from Angel's feedback)

- The narration model list is no longer a hand-curated table of five —
  it now comes live from NanoGPT's `/v1/audio-models` listing (~22 TTS
  models: MiniMax Speech, Inworld, Gemini TTS, ElevenLabs, MAI-Voice-2,
  SpaceXAI, Qwen, Kokoro, OpenAI…), shown in the same rich menu as the
  other stages: search, provider groups (new glyphs for ElevenLabs,
  Inworld, Microsoft, Kokoro), $/1k-chars badges, date chips, sort and
  provider filters. The `type=tts` filter leaks music/SFX models — they
  are filtered client-side (see LESSONS).
- Three pricing shapes parsed exactly (per-1k-chars; per-300-char-block
  with a minimum, ByteDance style; flat per-generation, VibeVoice style)
  — the workbench's "exact cost" stays exact for all of them, and the
  billing note adapts.
- **Voice previews**: the voice dropdown became a menu with humanized
  names ("af_bella" → "Bella — American female", search box for the
  65-voice models) and a ▶ button per voice. NanoGPT exposes no free
  sample files, so ▶ narrates one short fixed sentence through the real
  endpoint — the exact fraction-of-a-cent price is printed in the menu
  footer, the spend is logged honestly ("Voice preview — …") — and the
  audio is cached in OPFS forever: replays are free, and the cache
  survives project deletion (it lives outside project blob prefixes).
- Tests: 217 unit; e2e audio spec extended (menu filters the music leak,
  preview narrates the sample with the right voice, spend logged) — per
  Angel's ask, only the touched e2e specs were run this slice.

## Slice 15.8 — Rich model menu (2026-08-22, from Angel's feedback)

- All three model pickers (text/vision, image, video) trade the native
  `<select>` for a NanoGPT-style menu: a search box, models grouped by
  provider with colored glyphs and counts, per-model price badges
  ($in/$out per MTok for text, $/img, ≈$ per clip range for video) and
  release-date chips ("May 2026"), plus a Filters & Sort rail — sort by
  Provider / Name / Cheapest / Priciest / Newest / Oldest, filter to one
  provider (with an All reset), footer shows "X of N models".
- NanoGPT's listings carry no provider field, so the provider is
  inferred from the model id via a curated substring table (the same
  trick NanoGPT's own site uses); unmatched ids group under "Other".
  Release dates come from the listing's `created` unix timestamp, newly
  parsed into `releasedAt` on all three model types.
- The menu is a portaled overlay (the navbar transform-traps
  `position: fixed`, lesson from 15.5) with full keyboard/ARIA wiring:
  the trigger is a labeled button, the panel a dialog, options a
  listbox, Escape closes. External picker APIs are unchanged — the
  wrappers still filter to vision/i2v/img2img models where required.
- Tests: 205 unit, 37 e2e (e2e helpers gained `pickModel`, which picks
  by model id since display names collide; the animation spec now
  asserts the menu offers only image-to-video models with price badges
  and sort controls).

## Slice 15.7 — Edit the scene prompt from any stage (2026-08-22, from Angel's feedback)

- The scene's visual description is now editable in place on the Images
  and Animation workbenches (shared `SceneDescriptionEditor`): an Edit
  button swaps the text for a textarea with Save/Cancel, saving through
  `updateScene` — one source of truth, so Scenes, Images and Animation
  all see the change instantly, no walking back a stage. Already-made
  takes keep the prompts they were generated with (append-only history);
  only future generations pick up the edit, and the editor says so.
- Tests: 197 unit, 38 e2e (edit on Images → Scenes shows the new text;
  Cancel discards).

## Slice 15.6 — Camera direction helper (2026-08-22, from Angel's feedback)

- The Motion panel gains an optional **Camera direction** textarea per
  scene (stored on the scene, autosaved, additive schema): position and
  movement hints like "fixed tripod", "slow push-in", "pan left",
  "gentle zoom out" — the placeholder spells the idea out. (First landed
  as a cramped one-line input in the Animate panel; moved and widened on
  Angel's feedback — one home, full placeholder visible.)
- When set, the note is woven into the video prompt as `Camera: …` and
  REPLACES the built-in gentle-drift default (a fixed-tripod ask must not
  fight a baked-in drifting camera); when empty, the default stands.
  History keeps the full composed prompt for verbatim regeneration as
  always.
- Tests: 197 unit, 37 e2e (submitted prompt carries the camera line and
  drops the drift default).

## Slice 15.5 — Spend moved into a navbar dropdown (2026-08-22, from Angel's feedback)

- The always-mounted spend bar above the stages is gone — one full strip
  of screen back. The navbar "Spent $X · N" readout (unchanged look, plus
  a small caret) is the door now: **hovering** shows a compact summary —
  total plus per-kind lines (Text / Images / Clips / Narration) with
  exact amounts and counts — and **clicking** opens the full breakdown as
  a frosted overlay (every entry with date, note, model, estimated vs
  actual; Close button, Escape, or an outside click dismisses it).
- The overlay renders through a portal: the navbar centers itself with a
  CSS transform, and a transformed ancestor traps position:fixed inside
  it — the first screenshot pass caught the clipped result.
- E2e specs assert spend through the new dropdown (`expectSpendBreakdown`
  helper); `CostSummary` is deleted. 195 unit + 37 e2e.
- Follow-up (Angel's catch): the overlay card shipped with its content on
  the edges — the padding used `var(--space-5)`, a token that does not
  exist in the scale (…4, 6, 8), and one undefined var() silently drops
  the whole declaration. Real tokens now, and the codebase scans clean of
  phantom spacing tokens.

## Slice 15.4 — Narration in the fullscreen viewer (2026-08-22, from Angel's feedback)

- Expanding a clip into the lightbox now plays the scene's narration in
  sync with it — start, seeks and pauses follow the clip, and when the
  looping clip wraps, the narration restarts with the next lap (a finished
  take never restarts mid-lap). A "♪ Mute narration" pill sits over the
  viewer, silencing the voice without touching the clip's own sound.
- Tests: 195 unit, 37 e2e (the narration-sync e2e now walks into the
  viewer and toggles its mute).

## Slice 15.3 — Import clip & the CORS wall (2026-08-22)

- The relative-URL fix surfaced the next wall: NanoGPT's content endpoint
  redirects to a presigned Cloudflare R2 URL whose bucket sends no CORS
  headers, so a browser app cannot READ those bytes at all (their own
  same-origin site can). When collection hits this, the job now fails
  with the honest instruction instead of a generic error.
- **Import clip**: the Clips panel takes a video file from disk as a new
  free take (`model: 'imported'`, no cost-log entry) — the escape hatch
  for CORS-walled models, and useful for externally edited clips.
- Tests: 195 unit, 37 e2e; LESSONS entry on the R2 redirect.

## Slice 15.2 — The Grok clip mystery, solved (2026-08-22, diagnosed with Angel)

- Angel's console diagnostics showed the broken "clip" was 988 bytes of
  Kairo's own index.html: grok-imagine-video returns a RELATIVE video URL
  (`/api/generate-video/content?...`), which `fetch` resolved against the
  app's origin — and the dev server served the SPA shell, which got stored
  as the clip. Absolute CDN URLs (Bytedance) worked, masking the cause.
- Collected video URLs now resolve against the NanoGPT origin, and the
  download goes through the client: NanoGPT-origin URLs are authenticated
  with the API key, third-party CDN URLs never see it.
- `normalizeProject` heals media versions stored with a wrong-kind MIME
  type (e.g. octet-stream video) to their kind's default container.
- Tests: 193 unit, 36 e2e — including one that replays the exact Grok
  scenario (relative URL → fetched from NanoGPT with the key).

## Slice 15.1 — Clip playback & narration sync (2026-08-22, from Angel's feedback)

- **Fixed: clips from some video models rendered as a black player** while
  playing fine on NanoGPT itself. OPFS returns files with an empty MIME
  type (blob paths have no extension), so playback depended on Chromium
  sniffing the container — fine for plain mp4, silent failure for others.
  `useBlobUrl` now re-wraps every media blob with the stored
  `AssetVersion.mimeType`, which also heals already-broken clips without
  regenerating. Collection additionally validates the download (non-empty,
  not an HTML/JSON error page) and keeps the CDN's real video type.
- Hardened `/video/status` parsing: tolerant URL extraction
  (`output.video.url` plus the variants seen in the wild) and lowercase
  status normalization — a paid, completed job is never dropped over a
  field name.
- **Durations**: when a model advertises its supported clip lengths the
  Duration select offers exactly those; when it doesn't, an honest note
  says the model may produce the nearest length it can (the 8s→5s
  surprise). Once a clip lands, its real length shows beside it — with an
  accent warning when it mismatches the narration ("clip runs 5.0s — the
  narration runs 7.5s, so it will be cut off").
- **Narration rides the clip player**: playing a clip now starts its
  narration in sync (seeks and pauses follow too), with a Mute toggle that
  silences the voice without touching the clip's own audio.
- Tests: 190 unit, 34 e2e; two LESSONS entries (OPFS strips MIME types;
  the test Chromium has no h264 — webm fixtures only).

## Slice 15 — Audio stage: TTS narration (2026-08-22, ADR-012)

- New **Audio** stage between Scenes and Images: each scene's script
  excerpt can be narrated with NanoGPT text-to-speech. Skippable by
  design — Images never waits for narration.
- Curated TTS catalog (`src/domain/ttsModels.ts`): Kokoro-82m (cheap
  default, 7 voices), gpt-4o-mini-tts, tts-1, tts-1-hd, ElevenLabs Turbo
  — hand-checked prices per 1k characters, voice lists, input caps
  (NanoGPT has no TTS listing endpoint to fetch).
- **Exact pricing**: TTS bills by input characters, so the price shown
  before the click is exact, not an estimate — the UI says so, and the
  cost log records estimate = actual. `formatUsd` now keeps at least two
  significant digits below a cent (a $0.000055 narration no longer
  renders as "$0").
- Takes are append-only audio `AssetVersion`s in OPFS with the standard
  active-take switch, history viewer and edit-and-regenerate (edited text
  reprices live, "this exact text will be narrated"). Batch "Narrate N
  remaining scenes" with an exact total. Additive schema
  (`audioVersions`/`activeAudioVersionId`, backfilled) and `.kairo`
  export/import carry narrations.
- Animation stage plays each scene's narration beside its clips and shows
  the narration's duration so clip length can be matched to it. The clips
  zip now includes `narration-NN.mp3` for every narrated scene, clipless
  ones included.
- Tests: 188 unit, 33 e2e (narrate → takes → exact cost logged → reload;
  Images stays unlocked without audio; deck expects Audio after Scenes).

## Slice 14.2 — Images/Animation polish (2026-08-22, from Angel's feedback)

- **Lightbox**: frames and clips expand into a fullscreen viewer (hover
  expand button or double-click); closes on outside click or Escape;
  prev/next arrows and arrow-key navigation; the scene's prompt and
  script excerpt overlay the media on translucent glass. Media always
  renders at 92vh, however small the source.
- **Artistic style hub**: the style bar on Images is collapsible, shows a
  "notes set" indicator while closed, and now owns the visual style notes
  and style-from-image tools (moved out of Scenes; the scenes-side "Add
  art style" button is gone).
- Panel titles got a real hierarchy (bold title + muted explainer), the
  navbar/cost bar say "Spent", and stage panels' captions moved inside
  their glass boxes.

## Slice 14.1 — Contrast pass (2026-08-22, from Angel's feedback)

- Muted (secondary) text was failing WCAG AA in every light palette
  (~3.4:1); all ten palettes got new `textMuted` values, measured, not
  eyeballed: light themes now sit at 5.8–6.1:1, dark themes at ~9:1.
- The glass got denser so text reads over the bubbles: dark surfaces
  0.10→0.14 (panels) and 0.16→0.22 (controls), borders 0.22→0.30; light
  surfaces 0.55→0.72 and 0.90→0.95.
- Same tokens, no component changes — every theme picked the values up
  automatically.
- Placeholder text was still the browser's own dark gray (unreadable on
  dark glass): `::placeholder` now uses the contrast-checked muted token,
  with opacity forced to 1 for Firefox. Disabled buttons went 0.45 → 0.55
  opacity — still clearly disabled, no longer illegible.
- Dark-mode glass flipped from white-tint to black-tint (Angel's call):
  brightening surfaces under white text was REDUCING its contrast. Dark
  panels are now rgba(10,14,26,0.35) and inputs/controls rgba(8,11,20,0.45)
  — smoky glass the light text pops against; light mode keeps its white
  glass, where the same logic favors dark text.

## Slice 14 — Filmstrip workflow (2026-08-21)

- The workflow now presents as film-making equipment (ADR-011), the
  direction Angel chose from five canvas rounds:
- **Transport deck** — pipeline nav is a film-leader scrubber (previous
  button, progress-filled track with stop dots and a playhead, next-stage
  CTA pill, all on one center line) over a **segmented rail**: one glass
  control with a named, clickable segment per stage. Hand-drawn SVG state
  icons: punched-reel check (done), aperture (current, with a 4/6-style
  progress note), film-canister padlock (locked). Stage labels dropped
  their number prefixes.
- **The reel** — Images and Animation show scenes as 9:16 frames between
  film perforations; selecting a frame drives a three-panel workbench
  below (prompt / generate / takes; motion / animate / clips). Six scenes
  fit one screen. Batch generate, reference attachment notes, verbatim
  history regeneration and the video cost dialog all carried over intact.
- **Poster wall** — projects are 9:16 one-sheets with theme-seeded gradient
  art; create/import live in the page header.
- Wide layout: 96rem main container; Script keeps a 64rem reading column;
  Scenes becomes a responsive card grid; Export's panels sit in one row.
- Tests: 184 unit, 30 e2e (deck walks forward/back and respects locks;
  stage-nav selectors are exact-name; scene interactions go through the
  selected-frame workbench).

## Slice 13.1 — Palette dropdown & settings overlay (2026-08-21, from Angel's feedback)

- The light/dark toggle is gone: one palette dropdown now holds all ten
  palettes (modeled on Angel's reference screenshot) — the trigger is a 2×2
  swatch tile of the active palette, each row pairs a swatch tile with the
  palette name, and the active row is ringed in the accent color with a dot.
  Picking a light palette IS switching to light mode (`chooseTheme` sets the
  palette and its mode together); each mode still remembers its own last
  palette, and `prefers-color-scheme` still decides the first visit.
- Settings now opens as a fullscreen frosted overlay above the page you were
  on — the page stays mounted behind it, so closing returns you exactly
  where you were. The navbar gear swaps to an X while open; Escape closes
  it (and the palette dropdown). "Back to projects" is gone.
- Tests: 184 unit, 29 e2e (mode follows palette, dropdown close behaviors,
  overlay open/close via X and Escape).

## Slice 13 — Design pass (2026-08-21)

- The official Kairo look (ADR-010), set in stone after several design-canvas
  rounds: huge soft color bubbles blending into a solid ground color under a
  fine diagonal hatch, glass panels (`.card`), pill-shaped controls with one
  solid `.primary` CTA per surface, Instrument Sans (system-stack fallback
  offline).
- Ten palettes — Emberlight, Lagoon, Orchid, Citrus, North Sea (dark);
  Golden Hour, Sea Glass, Peony, Meadow, Lilac Dawn (light) — in
  `src/domain/themes.ts`, applied as CSS custom properties by `applyTheme()`.
  Components stay tokens-only.
- Top navbar: Kairo left; balance and open-project spend centered (hidden
  under 860px — CostSummary still covers small screens); palette dropdown,
  light/dark toggle, and Settings gear right, with room for the Slice 14
  language dropdown.
- Mode and a palette per mode persist in localStorage; with nothing stored
  the app follows the OS `prefers-color-scheme`. Switching modes returns to
  that mode's own last palette.
- Every bubble gradient is sized to its own box (`50% 50% at 50% 50%`) so it
  fades to zero inside it — no hard seams at div edges (the bug Angel's
  screenshots caught on the canvas).
- Animations and transitions are deliberately NOT here — they are the next
  job, on top of this static-first backdrop.
- Tests: 182 unit, 28 e2e (palette switching, mode toggle, per-mode memory,
  persistence across reloads).

## Slice 11.1 — Clip motion-prompt editing (2026-08-21)

- Clip history versions gained "Edit & regenerate": the stored motion prompt
  opens prefilled and the edited text is submitted VERBATIM
  (`promptOverride` on `generateSceneVideo` — no re-derivation from the
  visual description).
- Cost UX for the expensive kind (LESSONS rule): the generate button does
  not submit — it opens the Slice 6.1 confirmation dialog with model,
  resolution, duration, and the price picture; the history row says so
  upfront. Nothing is charged until "Submit and charge".
- The verbatim-editor hint is now per-surface (image surfaces mention that
  style and references are not re-added; clips use the generic wording).
- Tests: 172 unit, 25 e2e (dialog gates the submission — no request before
  confirm — and the request body carries the edited prompt verbatim).

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
