# CLAUDE.md — Éclose

## Project status

**The brief (`brief-claude-code.md`) is fully implemented** (milestones M1, M2 and M3: dial, input, phase sheet, prediction engine, onboarding, history, adaptive chips, pattern engine, settings, encrypted export/import, PWA, automated audits). **There is no longer any point in reading it**: it is kept as a historical archive. **The code and this file are authoritative.** In case of a contradiction between the brief and the code, the code is right — the discrepancies are decisions taken and validated along the way (see "Accepted discrepancies").

`phase-encre-v2.html` is NOT dead code: it is the **visual parity reference** used by `npm run parity`. Do not delete it. Any visual change to the dial must be applied to both (app + prototype) so that the guard stays exact.

## Commands

```bash
npm run dev          # development
npm run build        # next build + SW generation in out/ (always this command, never next build alone)
npm run lint         # tsc --noEmit (strict)
npm test             # Vitest — pure lib/, 100% of the functions
npm run e2e          # Playwright (requires an up-to-date build; serves out/ on :4173)
npm run parity       # pixel parity guard (dial + sheet) vs prototype (requires a build; fails if > 0.5% of pixels diverge)
```

Before any push: `lint` + `test` + `build` + `e2e` + `parity` must be green — the CI (`.github/workflows/ci.yml`) replays exactly this chain on every PR.
In this remote environment, Chromium is at `/opt/pw-browsers/chromium` (auto-detected; in CI/local it's the normal Playwright resolution) — never run `playwright install` here.

## Non-negotiable rules

- **Zero network requests at runtime.** No API route, no fetch, no CDN, no remote fonts (self-hosted via `next/font`). The `e2e/network-audit.spec.ts` test fails otherwise — do not weaken it.
- **Strict TypeScript, functional patterns, no classes, no `any`.**
- **No hard-coded text**: everything goes through `i18n/fr.json` + `en.json` (register: calm, informal tone, never guilt-tripping or alarmist).
- **"Éclose" is written in a single place only**: `lib/config.ts` (`APP_NAME`). Technical identifiers without the accent (`eclose`).
- **Motion never touches the ink ribbon** (the rAF canvas of `InkRing.tsx`). Motion scope: sheets, chips, onboarding, transitions. `LazyMotion` with **`domMax`** — not `domAnimation`, which does not include drag gestures (historical bug, do not "re-optimize" it).
- **A single leaf animation curve** (`lib/motion-tokens.ts`): `cubic-bezier(.32,.72,.28,1)` 480 ms, the one from the prototype. "Calm organic" register, never a pronounced bounce.
- **Optimistic writes**: the UI never waits on IndexedDB, no spinner.
- **Conventional commits, in French.**

## Non-goals (never implement, even on request)

No contraceptive or medical claim · no account, cloud sync, freemium, ads, third-party SDK or analytics · no pregnancy tracking · no astrology.

## Architecture — where things go

- `lib/`: **everything that computes** — pure, no DOM, covered by Vitest. Any new business logic goes here with its tests, never in a component.
- `components/` + `app/`: **everything that is visible** — thin, not unit-tested, covered by the e2e tests.
- Reactive reads: `useLiveQuery` (dexie-react-hooks); no global store, the need does not exist at this scale.

## Known pitfalls (learned the hard way)

- **Today's date comes from `useToday()`** (lib/hooks), never from `todayISO()` called in a component: the hook re-renders at midnight and on return to the foreground — otherwise an app left open logs against yesterday.
- **Service worker without automatic `skipWaiting`**: the new SW waits for the old tabs to close, otherwise an already-loaded page loses its hashed chunks when the cache is purged. The only immediate activation goes through the "new version ready · reload" toast (`SwRegister`): user gesture → `SKIP_WAITING` → reload on `controllerchange`. Do not "speed this up" any other way.
- **Parity bench**: the global CSS injected into the prototype references `var(--font-newsreader)` that only next/font defines — the script injects the missing variables, and tolerates ± 2 px of vertical alignment on the sheet (fractional bottom anchoring).

- **`InkRing.tsx`**: the blurred layer (per-stroke blur, identical to the prototype) is pre-rendered in an offscreen at an adaptive cadence. The cost of the canvas blur is paid at **deferred rasterization**, not at the draw call — device slowness is gauged on the frame delta that FOLLOWS a layer render. Applying the blur per frame on the main canvas collapses the event loop (2 fps in software rendering) and delays IndexedDB events by several seconds.
- **Scrollable sheets**: with `touch-action: pan-y`, the browser emits `pointercancel` before Motion sees the gesture — the swipe-to-dismiss "at the top of the scroll" is driven by non-passive `touchmove` listeners in `BottomSheet.tsx`, which write the same motionValue as the Motion drag. Do not simplify.
- **Dexie**: the stored IndexedDB version = Dexie version × 10 (an external `indexedDB.open('eclose', 1)` breaks it). The seed scripts open without a version number.
- **`_*` folders under `app/`**: private to the App Router, never routed.

## Key business rules (executable summary)

- **The 10-day rule** (`lib/logbook.ts`): a flow > 0 at ≤ 10 days from the last start extends the period; beyond that, it opens a new cycle (closing the previous one, `lengthDays` = difference of the starts). `setFlow` returns `newCycleStarted`: the UI then shows "new cycle, D1 · undo" (8 s) — the silent rebase of the dial is experienced as a bug.
- **Prediction** (`lib/engine.ts`): average of the last 6 closed cycles, window `lastStart + mean ± sd` (sd min 1 day), low/medium/high confidence. 0 cycles → discovery mode (neutral 28-day dial); lateness → calm message, never alarmist.
- **Patterns** (`lib/patterns.ts`): recurrence ≥ 60% of the closed cycles (min 3), ± 1 day window, max 2 per phase, always sourced wording, never causal.
- **Adaptive chips** (`lib/symptoms.ts`): defaults per phase, replaced from 2 closed cycles by the 3 symptoms actually logged the most in the phase (current cycle included, over its estimated length).
- **Local lock** (`lib/pin.ts`): 4–8 digit code, PBKDF2 hash + salt in Settings, unlock valid per session (`sessionStorage`). No recovery — this is documented in the UI. Threat covered: prying eyes, not a tooled attack.
- **Import** (`lib/logbook.ts` `mergeImport`): local logs/settings win, except on a blank device where the imported settings apply; a data import marks onboarding as done.
- **Today's note**: the `note` field of DailyLog, edited in the catalog sheet and the history editor (`NoteField`, debounced write).

## Accepted discrepancies vs the prototype/brief (validated decisions)

- Prediction window: the brief §5 formula (`lastStart + mean ± sd`), i.e. +1 day vs the prototype which shifted by one day.
- "Phase" wordmark → `APP_NAME`; the "living ink · instrument precision" tagline removed everywhere.
- "Luteal" label added on the dial (the prototype omitted it) — the reference prototype updated accordingly.
- Ribbon smoothing: 2 passes .22/.56/.22 instead of 3 passes .28/.44/.28 (the menstrual red was washed out over 5 days) — the reference prototype updated identically, boundaries still gradient.
- Ribbon menstrual ink: #db2f24 (`INK_COLORS` in lib/ink.ts) instead of the #e2543f token — the filament brightens ×1.28 with clipping, which turned the red to coral; the pigment therefore starts from a saturated red (low green/blue). The intermediate step #b23122 was abandoned: too dark, its blurred layer stayed dull against the luminous halos of the other phases (menstrual "in retreat"). #db2f24 radiates as much as they do without turning coral. The UI accent stays --c-menst. Prototype aligned.
- `domMax` instead of `domAnimation` (the drag requires it).
- In reduced-motion, a resize redraws a static frame (silent bug of the prototype, fixed).

## Deployment

Vercel: Build Command **`npm run build`** (otherwise no service worker), Output `out`, headers managed by `vercel.json`. The app is pure static — any static host works.
