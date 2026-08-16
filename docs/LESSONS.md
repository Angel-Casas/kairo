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
