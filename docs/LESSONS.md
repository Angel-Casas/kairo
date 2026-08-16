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
