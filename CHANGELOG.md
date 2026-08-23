# Changelog

Notable changes per slice. Dates are completion dates.

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
