# Kairo

Generate videos in any format — Shorts, widescreen, square — through a step-by-step pipeline —
**script → scenes → images → animation → export** — using your own
[NanoGPT](https://nano-gpt.com) API key. Pick your preferred model at every step
and pay only for what you actually generate. No subscription.

Kairo is a client-side PWA: your API key and all generated assets stay on your
device. The code is open (AGPL-3.0) so you can verify that yourself.

## Status

**Function-complete.** The full pipeline works end to end: script (write or
generate) → scene breakdown → styled images with versions → animated clips
(resumable async jobs) → export (clips zip, stitched draft, project backup).
Costs are shown before every generation and actuals are logged per project
and per account. Remaining work: visual design pass, i18n, deployment. See
`docs/ROADMAP.md` for the plan, `docs/DECISIONS.md` for architecture
decisions, and `CLAUDE.md` for project conventions.

## Development

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:5173
npm test             # unit tests (Vitest)
npm run e2e          # end-to-end tests (Playwright; npx playwright install first)
npm run lint         # lint (oxlint)
npm run format       # format with Prettier
npm run build        # typecheck + production build
```

## License

[AGPL-3.0-or-later](./LICENSE)
