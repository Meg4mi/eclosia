# Contributing to Éclose

Thank you for your interest in the project. Éclose is free software
(AGPL-3.0): contributions are welcome, as long as they respect what makes the
app what it is — its radical privacy and calm register.

## Philosophy in one sentence

**Everything computes on the device, nothing goes anywhere else, and the app
never makes you feel guilty.** A contribution that goes against this will not be
merged, however well written it may be.

## Non-goals (will never be accepted)

These refusals are design choices, not oversights:

- No contraceptive or medical claims.
- No account, cloud sync, freemium, advertising, third-party SDK, or analytics.
- No pregnancy tracking, no astrology.
- **Zero network requests at runtime**: no API route, no `fetch`, no CDN, no
  remote fonts. An automated test (`e2e/network-audit.spec.ts`) verifies this
  and must not be weakened.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Chromium for the Playwright tests installs via `npx playwright install
--with-deps chromium` (unnecessary in environments where it is already present).

## The quality chain (mandatory before any PR)

These five commands must be green — the CI (`.github/workflows/ci.yml`) replays
the exact same chain on every PR:

```bash
npm run lint       # tsc --noEmit (strict, never "any")
npm test           # Vitest — pure lib/, coverage of the business functions
npm run build      # next build + service worker generation (never next build alone)
npm run e2e        # Playwright (requires an up-to-date build)
npm run parity     # pixel parity guard of the dial vs prototype (> 0.5% = failure)
```

## Where things go

- `lib/` — **everything that computes**: pure, DOM-free, covered by Vitest. Any
  new business logic goes here, with its tests, never in a component.
- `components/` + `app/` — **everything that is visible**: thin, covered by the e2e tests.
- `i18n/fr.json` + `i18n/en.json` — **no hard-coded text**: every visible string
  goes through both dictionaries. Calm register, informal tone, never
  guilt-tripping or alarmist.

## Conventions

- **Strict TypeScript**, functional patterns, no classes, no `any`.
- The name "Éclose" is written in a single place: `lib/config.ts`. Technical
  identifiers stay without the accent (`eclose`).
- **Conventional commits, in French** (`feat:`, `fix:`, `docs:`, `refactor:`…).

## Reporting a bug or proposing an idea

Open an *issue* before a large PR: together we check that the direction is
compatible with the non-goals, which avoids wasted work. For a security
vulnerability, prefer a private report over a public issue.

## License of contributions

By submitting a contribution, you agree that it will be distributed under the
**AGPL-3.0** license, like the rest of the project.
