# LESSONS.md — Mistakes and the rules that prevent them

This file exists so the same mistake is never made twice. It is Claude's long-term
memory of what went wrong and Angel's accumulated taste.

**When to add an entry:** any time a bug ships, a design misses the mark, a test
gives false confidence, effort is wasted on the wrong thing, or Angel corrects
something that should not have needed correcting. Fixing the issue is not enough —
the entry is what prevents the _class_ of issue.

**How it's used:** Claude reads this file at the start of every session and treats
every "Rule going forward" as binding, with the same weight as CLAUDE.md.

## Entry template

```
### YYYY-MM-DD — Short title
**What happened:** one or two sentences.
**Root cause:** why it happened, not just what happened.
**Rule going forward:** a concrete, checkable rule.
```

Rules that prove universal get promoted into CLAUDE.md; the entry stays here with a
note that it was promoted.

---

## Entries

_None yet — project started 2026-08-16. May this file grow slowly._

### 2026-08-16 — Device-bridge git leaves stale lock files

**What happened:** Committing from the cloud session onto the local Kairo folder
worked, but the mount forbids file deletion, so git left `.git/index.lock` (and
tmp object files) behind, which blocks future git write operations.
**Root cause:** Cowork cloud sessions write to the local folder through a mount
that does not permit unlink; git relies on deleting its lock files.
**Rule going forward:** Git commits/pushes are run by Angel in a local terminal
(or a Cowork session running on the computer). Claude prepares files and
suggests the commit message instead of running git through the device bridge.
If git ever complains about `index.lock`, delete it manually: `rm .git/index.lock`.

### 2026-08-16 — Cost estimate was ~5× the real cost

**What happened:** The script stage estimated ~$0.003 for a generation that
actually cost $0.000592 (Angel verified against NanoGPT's request log:
117→192 tokens on Qwen3.8 27B). The output budget was set to 1000 tokens when
a ≤60s script is ~200, and `max_tokens` was not even sent, so the "budget"
constrained nothing. The model picker was also unusable: hundreds of models
in one flat dropdown, including non-chat endpoints.

**Root cause:** Estimate parameters were picked by feel instead of being
derived from the actual output size the prompt asks for, and never checked
against a real request. UI built against a 1-model mock never met the real
catalog size.

**Rule going forward:** Every cost estimate must (a) derive its output budget
from what the prompt actually requests, (b) enforce that budget via the API's
cap (`max_tokens` or equivalent) so the estimate is a true ceiling labeled
"up to ~", and (c) be validated against at least one real request before the
slice is called done. When the API reports usage/actuals, record them
(actualUsd in the cost log), estimates alone are not enough. And any UI fed
by a live catalog must be tested against realistic catalog sizes (hundreds),
not single-item mocks.

### 2026-08-16 — $1.80 video clips surprised a $5 budget

**What happened:** Angel animated 3 scenes at $1.80 each on a $5 balance.
The video model picker showed no prices, Kairo sent no resolution (so the
provider defaulted to an expensive tier — the model's listed $0.72 applied
to a cheaper resolution), and one click submitted a charge with no
confirmation. "Cost unknown, charged at submission" was honest but not
protective.

**Root cause:** The expensive generation kind got the WEAKEST cost UX in the
app. Pricing data existed on the models endpoint but wasn't parsed; the main
cost driver (resolution) wasn't user-controlled; and there was no friction
between click and charge.

**Rule going forward:** The more a generation kind can cost, the STRONGER its
cost UX must be: (a) surface whatever pricing data the provider exposes, even
imperfect ranges; (b) every parameter that drives cost (resolution, duration)
must be user-visible and default to the cheapest option — never inherit a
provider default silently; (c) any submission that can exceed ~$0.50 gets an
explicit confirmation stating the price picture before money moves.

### 2026-08-21 — E2e asserted UI state, then reloaded, and lost the race

**What happened:** The Slice 5 e2e "style gallery selects and persists a
preset" failed deterministically in a slower environment (Cowork cloud
container) while having always passed locally: the test asserted the radio's
`aria-checked` and immediately reloaded, but store actions update UI state
BEFORE `persistProject`'s IndexedDB write commits, so the reload could beat
the write. The app was fine; the test was timing-dependent.

**Root cause:** UI assertions were used as a proxy for persistence. The
optimistic-update pattern (set state, then await persist) makes the UI
visibly correct while the durable write is still in flight, so
"assert-visible then reload" encodes a race.

**Rule going forward:** An e2e that reloads to verify persistence must first
wait for the persisted data itself (poll IndexedDB via
`readStoredProjects` in `e2e/helpers.ts`), never only for UI state. Any new
"survives reload" test uses this helper before its `page.reload()`.

### 2026-08-21 — A new aria-label broke six specs via substring matching

**What happened:** The Slice 13 navbar added a spend indicator labeled
"Current project spend". Six existing e2e specs using
`getByLabel('Project spend')` (CostSummary) failed with strict-mode
violations: Playwright's `getByLabel` substring-matches by default, and
"Current **project spend**" contains "project spend".

**Root cause:** Accessible labels form one flat, case-insensitively
substring-matched namespace in the tests. A new label that CONTAINS an
existing label's text collides with every non-`exact` locator for it, even
though the two labels look clearly distinct to a human.

**Rule going forward:** When adding an aria-label, grep the e2e specs for any
existing label that is a substring of it (or vice versa) and rephrase to
avoid containment — as the navbar label "Spend in the open project" does.
Prefer rewording over sprinkling `exact: true` on old tests.

### 2026-08-21 — E2e ran against a stale preview server and tested the old build

**What happened:** After the palette-dropdown rewrite, six e2e specs failed
claiming the new button did not exist — while a manual check showed the app
rendered it fine. The Playwright `webServer` config has
`reuseExistingServer: !process.env.CI`, and a `vite preview` process left
over from an earlier screenshot script was still listening on 4173, serving
the previous build.

**Root cause:** Screenshot/debug scripts that spawn `vite preview` on the
e2e port and outlive their run silently satisfy Playwright's "server already
up" check, so the suite tests whatever bundle that stray server has.

**Rule going forward:** Screenshot and debug scripts must use a port other
than 4173, and must kill their server in a `finally`. If e2e failures claim
freshly-changed UI is missing, check for a stale listener on the e2e port
first (`ss -ltnp | grep 4173`) before debugging the app.

### 2026-08-22 — A clip that played fine on NanoGPT rendered as a black player in Kairo

**What happened:** Angel animated a scene with Grok Imagine Video; NanoGPT's
usage page played the finished clip, but Kairo's player stayed black with no
duration. Another model's clip (Bytedance Waver) played fine through the
identical code path.

**Root cause:** OPFS hands files back with an EMPTY MIME type — our blob
paths have no file extension, and `File.type` comes from the extension. The
object URLs we fed `<video>`/`<audio>` therefore carried no type at all, and
playback silently depended on Chromium sniffing the container. That works
for plain mp4 but fails for other containers some video models ship. NanoGPT
plays the same file because their CDN sends a correct `Content-Type` header.
We had stored the true type in `AssetVersion.mimeType` all along — display
just never used it.

**Rule going forward:** Never hand a raw OPFS `File` to a media element.
`useBlobUrl` takes the stored `mimeType` and re-wraps the blob with it —
every new media call site must pass it. And when collecting a paid asset
from a CDN, validate the response (non-empty, not text/html or JSON) before
storing; a stored "clip" that is really an error page is a silent money
loss.

### 2026-08-22 — The test Chromium cannot decode h264

**What happened:** A screenshot fixture generated with ffmpeg's libx264
failed with `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` in the Playwright-bundled
Chromium, which ships without proprietary codecs. It looked exactly like the
production bug just fixed.

**Rule going forward:** Media fixtures for e2e/screenshot runs must use
royalty-free codecs — VP9 in webm for video (`-c:v libvpx-vp9`), mp3/opus
for audio. If a video loads in real Chrome but not in the test browser,
suspect the codec before the code.

### 2026-08-22 — Grok's "video URL" was relative, so Kairo stored its own index.html as the clip

**What happened:** The unified status endpoint returned
`output.video.url = "/api/generate-video/content?..."` for
grok-imagine-video — a RELATIVE path. `fetch(url)` resolved it against the
app's own origin, the Vite dev server answered any unknown route with the
SPA shell, and 988 bytes of Kairo's index.html were stored as a completed,
paid clip. Absolute CDN URLs (Bytedance) worked fine through the same code,
which made it look model-specific.

**Root cause:** Two assumptions baked into collection: that the status URL
is always absolute, and that downloading it needs no auth. Grok's content
URL is both relative and on NanoGPT's authenticated API.

**Rule going forward:** Resolve every collected media URL against the
NanoGPT origin (`new URL(raw, origin)`) before fetching, attach the API key
ONLY when the URL's origin is NanoGPT's (a third-party CDN must never see
the key), and validate that what came back is media, not text/html or JSON.
When a stored asset misbehaves, inspect its first bytes before theorizing —
one look at `<!doctype html>` told us everything.

### 2026-08-22 — NanoGPT's content endpoint redirects to an R2 bucket with no CORS

**What happened:** With the relative-URL fix in place, the authenticated
download of a Grok clip still failed: `/api/generate-video/content`
answers with a redirect to a presigned `*.r2.cloudflarestorage.com` URL,
and that bucket sends no `Access-Control-Allow-Origin` — the browser is
forbidden from READING the bytes, whatever headers or method we use.
NanoGPT's own site is unaffected (same origin there). This is a hard
platform wall for a pure client-side app, not a Kairo bug.

**Rule going forward:** When a finished clip cannot be collected because
the fetch throws `TypeError` (the CORS signature), fail the job with the
honest instruction — the clip exists, download it from the NanoGPT gallery
and use "Import clip" (free) — never a generic "download failed". Worth
reporting to NanoGPT: CORS on the content redirect target would let API
clients collect clips directly.

### 2026-08-22 — An undefined CSS custom property silently drops the whole declaration

**What happened:** The spend-breakdown overlay shipped with zero padding —
its content sat on the card's edges. The style said
`padding: var(--space-4) var(--space-5)`, but the spacing scale has no
`--space-5` (it goes …4, 6, 8). A `var()` referencing an undefined custom
property makes the value invalid at computed-value time, and the browser
throws away the ENTIRE declaration — no error, no fallback, just missing
padding.

**Rule going forward:** Only use tokens that exist in `src/index.css`
(spacing: 1, 2, 3, 4, 6, 8). When a spacing/color looks absent at runtime
but the style is clearly written, suspect a phantom token first — and
`grep -rn "space-5\|space-7"` style scans confirm the codebase is clean.

### 2026-08-22 — NanoGPT's `type=tts` filter leaks music and SFX models

**What happened:** `GET /v1/audio-models?detailed=true&type=tts` returned
63 entries, but only ~22 are text-to-speech: the rest are music
generators, SFX tools and utilities (Mureka song tools, ACE-Step, stem
separation…) that the server-side type filter fails to exclude. Bonus
trap: VibeVoice carries `per_thousand_chars: 0` RIGHT NEXT TO its real
`per_generation: 0.15` price — a zero-valued price field means "not this
pricing shape", never "free".

**Rule going forward:** Never trust a listing filter blindly — keep only
entries positively identified as the wanted kind (here:
`capabilities.text_to_speech`, `category === 'audio_tts'`, or a
non-empty `voices` list), and treat zero-valued price fields as absent
when a sibling field carries the real price. Verified against a live
response captured by Angel (the docs only show a placeholder template).

### 2026-08-22 — Some TTS models "played" silence: providers ignore response_format

**What happened:** Voice previews generated (and billed) fine but never
made a sound on some models, while others worked — the split was the
clue. `/v1/audio/speech` fronts many providers, and several ignore
`response_format: 'mp3'`: they return WAV or OGG bytes, or a JSON
envelope holding base64 audio, while the Content-Type still claims mp3.
`<audio>` trusts the type, picks the wrong demuxer, and fails with no
error event reaching the UI. OPFS cache reads made it worse by stripping
the type entirely (the Slice 15 lesson, again).

**Rule going forward:** For any media blob crossing a provider boundary,
trust the BYTES: sniff the container from magic numbers
(`src/lib/audioBlob.ts`), unwrap JSON/base64 envelopes, re-type the
blob, and surface an honest error when no real media is found — the
same family of defense as the video pipeline's blob validation. And
always attach onerror/catch handlers to media playback so failure is a
message, not silence.

### 2026-08-22 — "Silent" TTS models were async: the endpoint returns a queue receipt

**What happened:** After the byte-sniffer fix, a stubborn set of models
(ElevenLabs, VibeVoice, Omnivoice, Qwen-3-TTS, ByteDance Seed Audio)
still produced no audio. Angel's console probe showed why: for these,
`POST /v1/audio/speech` answers 200/202 with
`{"status":"pending","runId":…,"charged":true,"cost":…}` — a queue
receipt, not audio. One endpoint, two contracts: synchronous bytes for
some models, an async job for others, distinguishable only by the
response's content-type. Kairo validated "is this audio?" but never
asked "is this a job?", so it cached 167-byte receipts as previews —
after the user had already been charged.

**Rule going forward:** Any NanoGPT generation response that is JSON
with `status: "pending"` and a `runId` is a JOB — poll its status
endpoint (`GET /tts/status?runId&model` for TTS) until `completed`,
then download the result URL with the same-origin key gating and
relative-URL resolution the video pipeline uses. And when a provider
has billed a call (`charged: true` or an HTTP 200), log the spend even
if the payload turns out unusable — the books must match the balance.

### 2026-08-22 — A queued run can be charged at submission and then fail

**What happened:** VibeVoice previews vanished without a trace: NanoGPT
accepted the submission (202, `charged: true`, $0.15), then the run
died on the FIRST status poll with
`{"status":"error","error":"Request failed…","terminal":true}`. Kairo
logged spend only after a fully successful run, so the charge never
reached the books — Angel concluded "we didn't even pay" while $0.15
per attempt was leaving his balance.

**Rule going forward:** The moment an envelope says `charged: true`,
that money is spent — book it, even (especially) when the run later
fails, using the envelope's own `cost` as the authoritative amount.
Honor `terminal: true` as "stop polling now" regardless of the status
string. And when a model fails server-side at a flat per-run price,
the kind thing is a clear error message, not silent retries.

### 2026-08-22 — "8 seconds" is not a universal language: some models only speak frames

**What happened:** Wan 2.1 returned a 5s clip for an 8s request. The
model has no `duration` parameter at all — it takes `num_frames` and
`frames_per_second`, ignores unknown fields, and falls back to its
defaults (81 @ 16fps ≈ 5.1s). Related: the listing's
`supported_parameters` has TWO schemas — legacy flat arrays
(`durations`, `resolutions`) and a structured
`parameters.<name>.{type,options,min,max,default}` form — and Kairo
only read the flat one, so newer models got generic fallback options
they don't support. Some ranges live ONLY in description text
("Frames per second (5-24)").

**Rule going forward:** Parse BOTH parameter schemas, and treat a
parameter the model doesn't advertise as one it will ignore — never
offer UI choices the API can't honor. For frame-based models, keep the
product language in seconds and translate at the API boundary,
preferring the cheapest plan that reaches the ask (fewest frames — the
frame count drives the surcharge), and say what was actually submitted.

### 2026-08-23 — `pkill -f` can match its own shell: the exit-144 mystery solved

**What happened:** Cleanup lines like `pkill -f "vite preview"` kept
killing the very shell that ran them: the wrapper's own command line
contains the literal string being matched, so `pkill -f` found and
signalled it. This is what the "random" exit code 144 failures were —
self-inflicted, not flakiness.

**Rule going forward:** Break the self-match with a character class —
`pkill -f "vite [p]review"` — so the pattern no longer matches the
line that carries it. Applies to every `pkill -f`/`pgrep -f` whose
pattern appears verbatim in the invoking command.

### 2026-08-23 — A transient absence is not a terminal state — and don't invent races

**What happened:** The interrupted-job e2e test started failing after the
motion pass. First diagnosis: "the API key is still loading from
IndexedDB when the resumed job's first poll fires, and
`pollVideoJobTick` treats a null key as 'project closed' — job silently
abandoned." A retry-on-null-key guard was added... and the test still
failed, because the key actually loads SYNCHRONOUSLY from localStorage —
the real culprit was the test's 30s budget: the flow runs the whole
pipeline twice and animations added stability-waits. A 60s budget fixed
it.

**Rule going forward:** Two lessons. (1) The retry guard stays — a
transient absence (settings not ready) must never share the terminal
"stop polling forever" path with a permanent one (project closed),
especially where user money rides on the poller. (2) When a fix is
applied and the symptom persists, the diagnosis was wrong — retract it
rather than stacking a second fix on top, and re-verify what the
failing assertion was actually waiting on.

### 2026-08-23 — A transformed ancestor quietly owns every fixed descendant

**What happened:** The stage-entrance animation kept `transform:
translateX(0)` pinned on the stage wrapper (`animation-fill-mode:
both`). Any transformed element becomes the containing block for
`position: fixed` descendants — and Lightbox + ConfirmDialog were the
only overlays rendered inline rather than portaled. Their "fullscreen"
veils silently became stage-sized: no dimmed navbar, no outside-click
target. Worse, with reduced motion on, the 0.01ms animation still
pinned its end-state transform, so the bug appeared even with no
visible animation.

**Rule going forward:** Every fullscreen overlay portals to `<body>`,
no exceptions — inline "happens to work" only until an ancestor gains
a transform, filter, or backdrop-filter. And never let an entrance
animation persist a transform (`fill-mode: both` on a keyframe ending
in `translateX(0)`/`scale(1)` still counts as transformed); let it
revert to the natural, untransformed state.

### 2026-08-23 — Honoring reduced-motion silently reads as "your animations are broken"

**What happened:** The motion pass dutifully collapsed all animation
under `prefers-reduced-motion` — and Angel, whose OS had Reduce Motion
on, reported "not a single animation works." The a11y behavior was
correct; the SILENCE was the bug. Nothing anywhere said motion was
being suppressed or why.

**Rule going forward:** When the app deliberately disables something
because of an OS/accessibility signal, say so where the user would
look for it and offer an override (Settings → Motion: Follow system /
Always on / Off). Also: e2e now runs on the reduced-motion path via
Playwright's `contextOptions.reducedMotion` — animations add ~300ms of
actionability waiting per click and belong to visual review, not to
logic tests.

### 2026-08-23 — Opacity 0 is not gone: composited layers can ghost

**What happened:** The pastel hover ring (a masked, @property-animated
pseudo-element) faded out with an opacity transition — and on real-GPU
Chrome, fragments of the ring sometimes stayed painted after unhover.
Opacity 0 keeps the compositor layer alive; a layer whose animated mask
stops mid-cycle can leave its last frame on screen. Headless (software)
rendering never reproduced it — the screenshots were pixel-clean while
Angel's browser showed ghosts.

**Rule going forward:** Anything decorative that animates masks,
filters, or custom properties must not merely fade out — pair the
opacity transition with `visibility: hidden` (delayed to the fade's
end) so the layer is torn down. And treat "headless can't reproduce a
rendering artifact" as expected, not as proof it's fixed: verify the
layer is actually destroyed (computed visibility), not just invisible.

## An invisible pseudo-element still occupies scrollable overflow (18.3)

The pastel hover ring is a `button::before` with `inset: -4px`,
`visibility: hidden` until hover. Hidden or not, an absolutely
positioned box that extends past its scroll container's content edge
COUNTS as scrollable overflow — and in LTR only the rightward/downward
excess extends the scroll range. Result: every horizontal scroller
holding ring-bearing buttons carried 4 phantom pixels past its last
item, so "scrolled to the end" was never actually the end. In the
stage rail that surfaced as a dark crescent at the pill corner that
survived two geometry fixes (18.1, 18.2) because the geometry was
right — the scroll math wasn't.

Diagnosis that worked: stop eyeballing corners and measure — a sweep
across widths printed a CONSTANT 5px gap (4px inset + 1px border),
which is a signature, not a coincidence. Fix: groups excluded from the
ring (`.rail-segment`, `.reel-frame`, `[role='option']`) get
`content: none`, not just no hover style — a box that never paints
should never exist.

## A blob read back from OPFS has no MIME type — restore it before it leaves the app (22.11)

OPFS stores bytes, not metadata: `getFile()` on an extension-less path
returns a type-less blob. The UI already knew this (`useBlobUrl` takes
the stored `mimeType`; the lip-sync path re-wrapped its audio blob) —
but `blobToDataUrl` quietly stamped every type-less blob `image/png`.
So an imported JPEG rode to the API as `data:image/png;base64,/9j/…`:
PNG label, JPEG bytes. Lenient providers sniff the bytes and cope;
strict ones (Grok Imagine 2.0 Edit) drop the reference as
not-an-image and then report that no input image arrived — an error
that pointed everywhere except the label.

The rule: every `AssetVersion` records its true `mimeType` at
creation, and ANY path that serializes a stored blob for the outside
world (data URLs, uploads) must restore it. The paired diagnostic —
"Kairo attached N reference images" appended when a provider claims
none arrived — turns the contradiction into a one-glance diagnosis:
label bug on our side before 22.11, provider-side gap after.
