# CLAUDE.md — Éclose

## Project status

**The original brief is fully implemented** (milestones M1, M2 and M3: dial, input, phase sheet, prediction engine, onboarding, history, adaptive chips, pattern engine, settings, encrypted export/import, PWA, automated audits). **The code and this file are authoritative** — the "Accepted discrepancies" section records the decisions taken and validated along the way where the implementation diverged from the initial plan.

Post-brief enhancements (documented in "Key business rules" below): phase arrival dates (`phaseTiming`), trend-aware prediction (`cycleTrend`), confirmed-run period recalibration (`lib/period.ts`), the History symptom heatmap with its period row (`lib/heatmap.ts`), cycle-vs-average deltas, the PWA quick-log shortcut, note surfacing (History note search + day markers), and the prediction "why this window?" sheet.

## Commands

```bash
npm run dev          # development
npm run build        # next build + SW generation in out/ (always this command, never next build alone)
npm run lint         # tsc --noEmit (strict)
npm test             # Vitest — pure lib/, 100% of the functions
npm run e2e          # Playwright (requires an up-to-date build; serves out/ on :4173)
```

Before any push: `lint` + `test` + `build` + `e2e` must be green — the CI (`.github/workflows/ci.yml`) replays exactly this chain on every PR.
In this remote environment, Chromium is at `/opt/pw-browsers/chromium` (auto-detected; in CI/local it's the normal Playwright resolution) — never run `playwright install` here.

## Non-negotiable rules

- **Zero network requests at runtime.** No API route, no fetch, no CDN, no remote fonts (self-hosted via `next/font`). The `e2e/network-audit.spec.ts` test fails otherwise — do not weaken it.
- **Strict TypeScript, functional patterns, no classes, no `any`.**
- **No hard-coded text**: everything goes through `i18n/fr.json` + `en.json` (register: calm, informal tone, never guilt-tripping or alarmist).
- **"Éclose" is written in a single place only**: `lib/config.ts` (`APP_NAME`). Technical identifiers without the accent (`eclose`).
- **Motion never touches the ink ribbon** (the rAF canvas of `InkRing.tsx`). Motion scope: sheets, chips, onboarding, transitions. `LazyMotion` with **`domMax`** — not `domAnimation`, which does not include drag gestures (historical bug, do not "re-optimize" it).
- **A single leaf animation curve** (`lib/motion-tokens.ts`): `cubic-bezier(.32,.72,.28,1)` 480 ms, the one from the prototype. "Calm organic" register, never a pronounced bounce.
- **Optimistic writes**: the UI never waits on IndexedDB, no spinner.
- **Conventional commits, in English.**

## Non-goals (never implement, even on request)

No contraceptive or medical claim · no account, cloud sync, freemium, ads, third-party SDK or analytics · no pregnancy tracking · no astrology.

## Architecture — where things go

- `lib/`: **everything that computes** — pure, no DOM, covered by Vitest. Any new business logic goes here with its tests, never in a component.
- `components/` + `app/`: **everything that is visible** — thin, not unit-tested, covered by the e2e tests.
- Reactive reads: `useLiveQuery` (dexie-react-hooks); no global store, the need does not exist at this scale.

## Known pitfalls (learned the hard way)

- **Today's date comes from `useToday()`** (lib/hooks), never from `todayISO()` called in a component: the hook re-renders at midnight and on return to the foreground — otherwise an app left open logs against yesterday.
- **Service worker without automatic `skipWaiting`**: the new SW waits for the old tabs to close, otherwise an already-loaded page loses its hashed chunks when the cache is purged. The only immediate activation goes through the "new version ready · reload" toast (`SwRegister`): user gesture → `SKIP_WAITING` → reload on `controllerchange`. Do not "speed this up" any other way.
- **`caches.match` must pass `ignoreVary: true`** (with `ignoreSearch`): a static host serves assets with `Vary: Accept-Encoding` (gzip/br negotiation). Without the flag, a cache-first match depends on the request's content negotiation — an `Accept-Encoding` that differs from the precache `fetch` makes the match miss, the request falls through to the network and fails offline (the installed PWA "won't open"). Cache-first must always serve the stored byte, encoding-independent. The navigation fallback serves the cached start_url `/` first (canonical, always precached), then `/index.html`. Guarded by `e2e/offline.spec.ts`, which precaches against an ephemeral host then **shuts it down** — a real "connection refused", because Playwright's `setOffline`/route-abort silently disable SW interception (WebKit especially), so they can't prove offline serving works.
- **The precache must self-heal, not just install**: WebKit (iOS) evicts Cache Storage under disk pressure **without unregistering the service worker** (`storage.persist()` is only a hint). Since `install` replays only on a version change, an install-only precache stays empty forever after a purge — every online launch works (network, so invisible) and every cold offline launch shows the OS "not connected" page. The SW therefore repairs on every navigation (shell `/` missing from cache → full re-precache, shell-first) and writes back cache-missed successful GETs. Cache intact → one `caches.match`, zero network: the runtime network audit stays green. Guarded by the purge-simulation test in `e2e/offline.spec.ts`.
- **`InkRing.tsx`**: the blurred layer (per-stroke blur, identical to the prototype) is pre-rendered in an offscreen at an adaptive cadence. The cost of the canvas blur is paid at **deferred rasterization**, not at the draw call — device slowness is gauged on the frame delta that FOLLOWS a layer render. Applying the blur per frame on the main canvas collapses the event loop (2 fps in software rendering) and delays IndexedDB events by several seconds.
- **Scrollable sheets**: with `touch-action: pan-y`, the browser emits `pointercancel` before Motion sees the gesture — the swipe-to-dismiss "at the top of the scroll" is driven by non-passive `touchmove` listeners in `BottomSheet.tsx`, which write the same motionValue as the Motion drag. Do not simplify.
- **Dexie**: the stored IndexedDB version = Dexie version × 10 (an external `indexedDB.open('eclose', 1)` breaks it). The seed scripts open without a version number.
- **`_*` folders under `app/`**: private to the App Router, never routed.

## Key business rules (executable summary)

- **The 10-day rule** (`lib/logbook.ts`): a flow > 0 at ≤ 10 days from the last start extends the period; beyond that, it opens a new cycle (closing the previous one, `lengthDays` = difference of the starts). `setFlow` returns `newCycleStarted`: the UI then shows "new cycle, D1 · undo" (8 s) — the silent rebase of the dial is experienced as a bug.
- **Prediction** (`lib/engine.ts` `predict`): average of the last 6 closed cycles, window `lastStart + mean ± sd` (sd min 1 day), low/medium/high confidence. 0 cycles → discovery mode (neutral 28-day dial); lateness → calm message, never alarmist. When `cycleTrend` detects a clear drift (linear regression over the last 6 closed cycles, slope ≥ 0.5 d/cycle **and** R² ≥ 0.6 — noise must never read as a trend), the forecast follows the slope instead of the mean and `sd` becomes the residual spread around it. `averageCycleLength` still returns the plain mean for anything that must say "your average" rather than the forecast (History stats, cycle-vs-average deltas) — never conflate the two.
- **Phase timing** (`lib/engine.ts` `phaseTiming`): approximate arrival date per phase — current cycle's bounds if the phase is in progress or still ahead this cycle, else projected onto the next cycle (`lastStart + meanLength + offset`). A late cycle keeps the current phase "current" from its real start rather than projecting forward. Surfaced in the phase sheet's timing line and Today's phase strip.
- **Period length recalibration** (`lib/period.ts` `observedPeriodLength`, invoked from `lib/logbook.ts`): `avgPeriodLength` is the median of *confirmed* flow runs. A run only counts once a later log exists in the **same** cycle, proving tracking continued past the last flow day — this is the guard against a logging streak abandoned mid-period being read as a genuinely short period (a log in the next cycle does not confirm the previous one; the silence may have lasted the whole cycle). Median, not mean, so one odd cycle doesn't move the dial's menstrual arc.
- **Symptom heatmap** (`lib/heatmap.ts`, rendered in History): symptom × cycle-day counts over the last 8 closed cycles, the 6 most-logged symptoms (≥ 2 occurrences to appear), cells tinted with the phase ink of their column. A **period row** (`flow`) opens the grid: per cycle-day, how many of the retained cycles carried a flow > 0, always menstrual-tinted and scaled by the cycle count (not the symptom `max`) so it reads as period-length regularity. Gating is unchanged — the whole section stays hidden below 2 closed cycles or with no recurring symptom (the period row rides on the symptom grid, it does not resurrect an otherwise-empty one).
- **Note surfacing** (History): the `note` field is written by `NoteField` (debounced) and now readable without reopening each day — a small ink dot marks days that carry a note, and a search field (shown only when at least one note exists) filters notes by content, each result opening that day's editor. Pure client-side `includes` match, no index.
- **Prediction "why this window?"** (`components/sheet/PredictionSheet.tsx`, opened from Today's prediction line, hidden in discovery): explains the forecast from the `Prediction` object + `cycleTrend` — cycles considered (`basedOn`), average cycle (`averageCycleLength`, the plain mean, never the trend forecast), regularity (`sd`), the window method, a trend note when a slope is detected, and a plain-language confidence reason. `basedOn === 0` (just onboarded) shows the honest "typical 28-day length while I learn yours" copy.
- **Cycle vs. average** (History, uses `averageCycleLength`): a closed cycle ≥ 2 days off the average shows "N days longer/shorter than your average" next to its length. Silent below 2 days (normal jitter) and below 3 closed cycles (too little history for "your average" to mean anything).
- **PWA quick-log shortcut** (`app/manifest.ts` + Today page): a manifest shortcut opens `/?log=1`. Settings load asynchronously from IndexedDB after first render, so Today retains the request (`wantsLog` state) and only opens the logging catalog once `settings.onboardedAt` is known, then clears the query string.
- **Patterns** (`lib/patterns.ts`): recurrence ≥ 60% of the closed cycles (min 3), ± 1 day window, max 2 per phase, always sourced wording, never causal.
- **Adaptive chips** (`lib/symptoms.ts`): defaults per phase, replaced from 2 closed cycles by the 3 symptoms actually logged the most in the phase (current cycle included, over its estimated length).
- **Import** (`lib/logbook.ts` `mergeImport`): local logs/settings win, except on a blank device where the imported settings apply; a data import marks onboarding as done.
- **Today's note**: the `note` field of DailyLog, edited in the catalog sheet and the history editor (`NoteField`, debounced write).

## Accepted discrepancies vs the prototype/brief (validated decisions)

- Prediction window: the brief §5 formula (`lastStart + mean ± sd`), i.e. +1 day vs the prototype which shifted by one day.
- "Phase" wordmark → `APP_NAME`; the "living ink · instrument precision" tagline removed everywhere.
- "Luteal" label added on the dial (the prototype omitted it).
- Ribbon smoothing: 2 passes .22/.56/.22 instead of 3 passes .28/.44/.28 (the menstrual red was washed out over 5 days), boundaries still gradient.
- Ribbon menstrual ink: #db2f24 (`INK_COLORS` in lib/ink.ts) instead of the #e2543f token — the filament brightens ×1.28 with clipping, which turned the red to coral; the pigment therefore starts from a saturated red (low green/blue). The intermediate step #b23122 was abandoned: too dark, its blurred layer stayed dull against the luminous halos of the other phases (menstrual "in retreat"). #db2f24 radiates as much as they do without turning coral. The UI accent stays --c-menst.
- `domMax` instead of `domAnimation` (the drag requires it).
- In reduced-motion, a resize redraws a static frame (silent bug of the prototype, fixed).

## Deployment

Vercel: the build is pinned **declaratively in `vercel.json`** (`framework: null`, `buildCommand: npm run build`, `outputDirectory: out`, `cleanUrls`, headers) — never rely on dashboard settings: the Next.js preset runs `next build` alone, which skips SW generation and ships a site whose `/sw.js` 404s (registration fails silently, zero offline — this happened in production). The app is pure static — any static host works.
