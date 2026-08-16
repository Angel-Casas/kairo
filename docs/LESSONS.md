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
