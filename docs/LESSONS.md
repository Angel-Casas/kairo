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
