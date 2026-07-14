# Claude Code Brief — Éclose
**Menstrual cycle tracking app. Name: Éclose** (domain: eclose.app — single `APP_NAME` variable, never hard-code the name anywhere other than the config; the accent appears in the UI and the brand, never in the technical identifiers)

---

## 1. Vision

A menstrual tracking PWA that combines what no app on the market combines: the radical privacy of Euki, the scientific rigor of Clue, and a "living ink × precision instrument" art direction unique in the category.

**Three non-negotiable pillars:**

1. **Radical local-first.** No data leaves the device. No account, no backend, no analytics, zero network requests after the first load (verifiable in the DevTools — it's a marketing argument). IndexedDB is the source of truth.
2. **One interaction per day.** The core gesture takes 5 seconds: a "period" chip (intensity in 3 drops) + 3 symptom pills adapted to the current phase. Onboarding = a single question. Full logging is optional, never guilt-tripping.
3. **Honest prediction.** Never a hard date. Always a window ("probably between July 24 and 27") with a displayed confidence level, which tightens as history builds up.

**Non-goals (never implement, even on future request):**
- No contraceptive claim or medical positioning (Natural Cycles' regulatory terrain). Discreet disclaimer in the settings.
- No account, no cloud sync in v1, no freemium, no ads, no third-party SDK (the Flo/Meta scandal is our founding counter-example).
- No pregnancy tracking in v1.
- No astrology content.

---

## 2. Stack & technical constraints

- **Next.js 16 (16.2.x stable) App Router + React 19 + strict TypeScript** (`strict: true`, no `any`), Turbopack by default, functional patterns, no classes. Start with `next@latest` and use `next upgrade` for updates; never pin to a major version at end of support.
- **Animations: Motion** (formerly framer-motion, `motion` package, import `motion/react`) — in **mandatory lightweight mode**: `LazyMotion` + `domAnimation` loaded once in the layout, `m.*` components only (never `motion.*`, to keep the bundle minimal). Allowed scope: bottom sheet (spring + drag-to-dismiss, replaces the prototype's hand-made touch handler), chip micro-interactions (tap scale, appearance), screen transitions, onboarding, `AnimatePresence` on the patterns. **Forbidden scope: the ink ribbon** — the prototype's rAF canvas stays as is, Motion never touches the dial rendering. Every Motion animation goes through `useReducedMotion()`.
- **Full PWA**: `manifest.json` (standalone, theme-color `#120d14`, maskable icons), precache-all service worker (the app is 100% static), `next-pwa` or a manual SW — propose and get it validated before implementing.
- **Vercel deployment**, static output. **No API route, no runtime network call.** Google fonts (Fraunces, Newsreader) must be self-hosted via `next/font` (otherwise network requests → breaks the promise).
- **Persistence: Dexie.js** on IndexedDB. Request `navigator.storage.persist()` on the first log.
- **Dial rendering**: 2D canvas (ink ribbon) + SVG overlay (graduations, labels, touch zones). No Three.js, no WebGL — the prototype proves that 2D canvas is enough.
- No UI library, no Tailwind: CSS modules or vanilla-extract, tokens as CSS custom properties (see §6).
- Conventional commits. Implementation plan submitted for approval before each code phase.

---

## 3. Visual source of truth

The `phase-encre-v2.html` file (provided alongside this brief) is **the exact reference** for the look and feel: colors, typography, ribbon animation, graduations, hairline needle, phase sheet, chips. The React port must be visually indistinguishable from the prototype before any evolution. The canvas transposes into a `useEffect` with rAF cleanup; the SVG overlay becomes JSX.

---

## 4. Data model (Dexie)

```ts
// db.ts
interface Cycle {
  id: string;            // ulid
  startDate: string;     // ISO date (day 1 of the period)
  endDate?: string;      // last day of the period (optional)
  lengthDays?: number;   // computed at close (next start - start)
}

interface DailyLog {
  date: string;          // ISO date, primary key
  flow: 0 | 1 | 2 | 3;   // none / light / medium / heavy
  symptoms: string[];    // symptom ids (see catalog §7)
  note?: string;         // optional free field (v1.1)
}

interface Settings {
  id: 'singleton';
  appName: string;
  locale: 'fr' | 'en';
  reducedMotion: 'system' | 'on' | 'off';
  onboardedAt?: string;
  avgPeriodLength: number; // default 5, recomputed
}
```

Business rules:
- A `flow > 0` logged on a day not covered by a cycle opens a new cycle if the last start date is more than 10 days old; otherwise it extends the current period.
- Closing a cycle (a new start) computes the `lengthDays` of the previous one.
- Every write is optimistic, no spinner: the UI must never wait on IndexedDB.

---

## 5. Cycle engine (lib/engine.ts — pure, tested)

Pure functions, no DOM dependency, covered by Vitest:

- `predict(cycles: Cycle[]): Prediction` → `{ meanLength, sd, windowStart, windowEnd, confidence }`.
  - `meanLength` = average of the last 6 closed cycles (or all if < 6).
  - Window = `[lastStart + mean − sd, lastStart + mean + sd]` (sd min 1 day).
  - `confidence`: 'low' (< 2 cycles), 'medium' (2–3), 'high' (≥ 4 and sd ≤ 2), 'medium' otherwise. Also show "based on N cycles".
- `phases(prediction, periodLength): PhaseRange[]` → menstrual D1–P, follicular P+1 → ov−3, ovulatory ov−2 → ov+1 (ov = L−14), luteal ov+2 → L. Boundaries displayed as gradients (3-pass color smoothing, cf. prototype), never as a sharp cut.
- `dayOf(date, lastStart): number` → day of the current cycle.
- `patterns(logs, cycles): Pattern[]` → insight engine, see §8.

Edge cases to handle explicitly: 0 cycles (discovery mode, neutral 28-day dial), 1 cycle (prediction 'low' based on it), late cycle (current day > windowEnd → calm message "your cycle is past your usual window", never alarmist), cycles < 21 days or > 40 days (gently suggest talking to a doctor, once, without repeating).

---

## 6. Design tokens

```css
--bg:#120d14; --ink:#f1e8e2; --muted:#8d7f88;
--hair:rgba(241,232,226,.12);
--c-menst:#e2543f; --c-foll:#a9c27a; --c-ovul:#f0b153; --c-lute:#a678c9;
```

- **Display**: Fraunces (weight 200 for the large "D16", opsz 144). **Text**: Newsreader, the italic carries the whole editorial register. No third family.
- Ambient tint (`--tint`) and accent follow the current phase; 1.5s transition.
- `prefers-reduced-motion`: static ribbon (t=0), no looping rAF, pulsations disabled — already implemented in the prototype, to be kept; on the Motion side, `useReducedMotion()` switches the springs to instant transitions.
- Animation grammar: the Motion springs must stay in the prototype's "calm organic" register — low stiffness, high damping, never a pronounced bounce. A single sheet curve, a single fade duration, reused everywhere (defined in a `motion-tokens.ts`).
- Performance: a single rAF, canvas sized in devicePixelRatio, aim for 60 fps on a mid-range mobile; if the canvas blur costs too much on Android, pre-render the blurred layer in an offscreen canvas updated at 15 fps.

---

## 7. Screens & interactions

**Onboarding (first open)** — a single screen, a single question: "When did your last period start?" (date picker + "I don't remember" → discovery mode). Nothing else. No first name, no goals, no questionnaire.

**Today (main screen)** — the dial: animated ink ribbon, hairline graduations (1/day, major /7, labels D1·D8·D15·D22), the uncertainty window marked with dotted lines on the graduation, hairline needle pointing to the "today" drop that breathes. Center: day + phase + contextual sentence. Below the dial: the honest prediction, then the input line (3-drop period chip + 3 symptom chips).

Adaptive chips: a global catalog of about twenty symptoms with stable ids; defaults per phase (menst: pain/fatigue/low mood; foll: high energy/good sleep/motivation; ovul: high energy/libido/ovulation pain; lut: restless sleep/irritability/sugar cravings). From 2 cycles of data, replace the defaults with the 3 symptoms the user actually logs the most in that phase. A "+" button opens the full catalog.

**Phase sheet (tap on an arc)** — bottom sheet: description, typical facts (energy/sleep/mood…), "next", **Your patterns** section. Swipe down to close. The global accent slides toward the color of the consulted phase.

**History (v1)** — a minimalist vertical list of closed cycles (dates, length, mini-arc), access to a past day's logs for correction.

**Settings (v1)** — encrypted export/import (§9), language, motion, full erasure (double confirmation), non-medical disclaimer, about.

Navigation: 3 destinations max (Today / History / Settings), discreet bar or gesture — propose before implementing.

---

## 8. Pattern engine

Goal: turn logs into one or two sentences per phase, like "Your sleep degrades at D-3 before your period, 3 cycles out of 4".

v1 algorithm, deliberately simple and explainable:
- For each symptom and each relative position (D1…Dn from the start, and D-1…D-7 before the next period), count the cross-cycle recurrence.
- A pattern is kept if present in ≥ 60% of closed cycles (min 3 cycles) over a ± 1 day window.
- Wording: always sourced ("seen over your last N cycles"), never causal, never prescriptive. Max 2 patterns per phase, sorted by recurrence.
- No pattern before 3 cycles: show "N more cycles and I'll be able to show you your personal patterns".

---

## 9. Encrypted export / import

- Export: full JSON (cycles + logs + settings) encrypted with **AES-GCM via Web Crypto**, key derived from a passphrase (PBKDF2, ≥ 300k iterations, embedded random salt). `.eclose` file downloaded locally.
- Import: the same path in reverse, with a preview ("14 cycles, 380 days of logs") before overwriting, and merge rather than overwrite if data exists (imported logs never replace a more recent local log on the same date).
- It is the only backup mechanism in v1; offer it gently after the 2nd closed cycle.

---

## 10. i18n & copy

- FR first, i18n structure from the start (JSON dictionaries, no hard-coded text), EN in v1.1.
- Register: editorial, calm, informal tone, never guilt-tripping, never alarmist, never "girly". The Newsreader italic carries the contextual sentences. The prototype's sentences are the tone reference.

---

## 11. Milestones

- **M1 — Core**: faithful port of the prototype (dial, input, phase sheet), Dexie, 1-question onboarding, tested prediction engine. Criterion: usable daily by a first real user.
- **M2 — Memory**: history, adaptive chips, pattern engine, edge-case handling (lateness, irregular cycles).
- **M3 — PWA & trust**: manifest + SW + iOS/Android installability, encrypted export/import, settings page, automated "zero network request" audit (a Playwright test that fails if a request goes out after boot).

At the end of each milestone: demo + review before continuing. No start of M+1 without validation.

---

## 12. Collaboration rules

- Detailed implementation plan submitted **before** any code, at each milestone.
- Strict TypeScript, functional patterns, conventional commits.
- Any visual deviation from `phase-encre-v2.html` must be flagged and justified.
- Tests: Vitest on `lib/engine.ts` and `lib/patterns.ts` (100% of the pure functions), Playwright for the network audit and the smoke test of the input flow.
- Token economy: don't re-read unchanged files, rely on this brief as the reference context.
