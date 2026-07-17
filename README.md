# Éclose

Menstrual cycle tracking. **Your cycle, on your device.**

A fully static, local PWA: no data ever leaves the device. No account, no server, no analytics, **zero network requests after the first load** — verifiable in the DevTools (Network tab), and verified by an automated test.

## Three principles

1. **Radical local-first.** IndexedDB is the only source of truth. The only backup is an encrypted export (AES-GCM, key derived from a passphrase) that you keep wherever you want.
2. **One interaction per day.** A "period" chip (intensity in 3 drops) + 3 symptom pills adapted to the current phase. Onboarding in a single question.
3. **Honest prediction.** Never a hard date: a window ("probably between July 24 and 27") with a displayed confidence level, which tightens as history builds up. When cycles show a genuine drift, the app says so and the window follows it — never silently.

## Stack

- **Next.js 16** (App Router, Turbopack, `output: 'export'`) · **React 19** · **strict TypeScript**
- **Dexie.js** on IndexedDB (reactive reads via `dexie-react-hooks`)
- **Motion** (`LazyMotion` + `domMax`, `m.*` components) for the sheet and micro-interactions — the ink ring stays pure 2D canvas (rAF)
- **CSS Modules** + design tokens as custom properties, **Fraunces / Newsreader** fonts self-hosted via `next/font`
- **Web Crypto** (AES-GCM, PBKDF2 300,000 iterations) for the `.eclose` export
- PWA: manifest + precache-all service worker generated at build time

## Getting started

```bash
npm install
npm run dev        # development (http://localhost:3000)
npm run build      # static build in out/ + service worker generation
npm start          # serve out/ locally
```

## Quality

```bash
npm run lint       # strict typecheck
npm test           # Vitest — cycle engine, patterns, business rules, crypto
npm run e2e        # Playwright — "zero network request" audit + logging flow
npm run parity     # pixel parity guard against the prototype (after npm run build)
```

`npm run parity` renders the app and the reference prototype (`phase-encre-v2.html`) under identical conditions and fails if more than 0.5% of the pixels of the dial or the phase sheet diverge. GitHub Actions CI replays the whole chain on every PR.

## Architecture

```
app/               screens (Today, History, Settings) — client, thin
components/        dial (canvas + SVG), input, sheets, onboarding, nav
lib/               everything that computes: pure, DOM-free, tested
  engine.ts        prediction, trend detection, phases, phase timing, cycle day
  patterns.ts      insight engine (cross-cycle recurrences)
  heatmap.ts       symptom × cycle-day counts (History)
  period.ts        confirmed-run period length recalibration
  logbook.ts       write-side business rules (cycles ↔ logs), optimistic
  ink.ts           ribbon colors, dial geometry
  crypto.ts        encrypted export/import
  db.ts            Dexie schema
i18n/              fr/en dictionaries — no hard-coded text in the code
```

## Deployment

Any static hosting; Vercel recommended:

- Build command: `npm run build` (essential — also generates the service worker)
- Output directory: `out`
- `vercel.json` provides the `Cache-Control: no-cache` on `sw.js` and the manifest

## Contributing

Contributions are welcome, as long as they respect the app's radical privacy and calm register. The details (quality chain, architecture, non-goals) are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Support the project

Éclose is free, ad-free, and does not resell data — by design. If the app is useful to you and you want it to stay that way, you can support its development on [Liberapay](https://liberapay.com/Meg4mi). No support is required to use the app fully.

## License

[AGPL-3.0](LICENSE). Éclose is free software: you can study, modify, and redistribute it. The AGPL "network" clause guarantees that any derivative service, even one deployed online, must also stay open source — that is what protects the project's privacy promises against a fork that would betray them.

## Note

Éclose is not a medical device and cannot be used as contraception. Predictions are estimates based on your personal history. ;)
