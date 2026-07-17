/** Moteur de cycle — fonctions pures, sans dépendance au DOM. Couvert par Vitest. */

import { DEFAULT_CYCLE_LENGTH } from './config';
import { addDays, diffDays } from './dates';
import type {
  Confidence,
  Cycle,
  PhaseKey,
  PhaseRange,
  PhaseTiming,
  Prediction,
} from './types';

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

const stddev = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const byStart = (a: Cycle, b: Cycle): number => a.startDate.localeCompare(b.startDate);

/** Cycles clos (longueur connue), triés chronologiquement. */
export const closedCycles = (cycles: Cycle[]): Cycle[] =>
  [...cycles].sort(byStart).filter((c): c is Cycle & { lengthDays: number } => c.lengthDays != null);

export const lastCycle = (cycles: Cycle[]): Cycle | null => {
  if (cycles.length === 0) return null;
  return [...cycles].sort(byStart)[cycles.length - 1] ?? null;
};

/**
 * Prédiction honnête : jamais de date sèche, toujours une fenêtre + confiance.
 * meanLength = moyenne des 6 derniers cycles clos (ou tous si < 6).
 * Fenêtre = [lastStart + mean − sd, lastStart + mean + sd] (sd min 1 jour).
 */
export const predict = (cycles: Cycle[]): Prediction => {
  const closed = closedCycles(cycles);
  const last = lastCycle(cycles);
  const lastSix = closed.slice(-6).map((c) => c.lengthDays as number);

  const meanLength = lastSix.length > 0 ? Math.round(mean(lastSix)) : DEFAULT_CYCLE_LENGTH;
  const sd = lastSix.length > 1 ? Math.max(1, Math.round(stddev(lastSix))) : 1;

  const n = closed.length;
  let confidence: Confidence;
  if (n < 2) confidence = 'faible';
  else if (n <= 3) confidence = 'moyenne';
  else confidence = sd <= 2 ? 'élevée' : 'moyenne';

  const anchor = last?.startDate ?? null;
  return {
    meanLength,
    sd,
    windowStart: anchor ? addDays(anchor, meanLength - sd) : '',
    windowEnd: anchor ? addDays(anchor, meanLength + sd) : '',
    confidence,
    basedOn: n,
    lastStart: anchor,
  };
};

/**
 * Découpage en phases pour un cycle de L jours :
 * menstruelle J1–P, folliculaire P+1 → ov−3, ovulatoire ov−2 → ov+1 (ov = L−14), lutéale ov+2 → L.
 * Les bornes sont clampées pour rester cohérentes sur les cycles courts.
 */
export const phases = (meanLength: number, periodLength: number): PhaseRange[] => {
  const L = Math.max(21, Math.round(meanLength));
  const P = Math.min(Math.max(1, Math.round(periodLength)), L - 10);
  const ov = Math.max(P + 4, L - 14);
  return [
    { key: 'menst', from: 1, to: P },
    { key: 'foll', from: P + 1, to: Math.max(P + 1, ov - 3) },
    { key: 'ovul', from: Math.max(P + 2, ov - 2), to: ov + 1 },
    { key: 'lute', from: ov + 2, to: L },
  ];
};

/** Jour d'ovulation estimé pour un cycle de L jours. */
export const ovulationDay = (meanLength: number): number => Math.round(meanLength) - 14;

/** Jour du cycle courant (J1 = lastStart). */
export const dayOf = (dateISO: string, lastStartISO: string): number =>
  diffDays(lastStartISO, dateISO) + 1;

/** Phase d'un jour de cycle donné ; au-delà de L (retard), on reste en lutéale — comme le prototype. */
export const phaseOfDay = (ranges: PhaseRange[], day: number): PhaseRange => {
  const found = ranges.find((p) => day >= p.from && day <= p.to);
  return found ?? (ranges[ranges.length - 1] as PhaseRange);
};

export const phaseByKey = (ranges: PhaseRange[], key: PhaseKey): PhaseRange =>
  ranges.find((p) => p.key === key) as PhaseRange;

/**
 * Quand cette phase est-elle atteinte ? Dates approximatives ancrées sur le cycle courant :
 * phase en cours ou à venir → ses bornes dans ce cycle ; phase déjà passée → projection sur
 * le cycle suivant (lastStart + meanLength). En retard, la lutéale reste « en cours ».
 */
export const phaseTiming = (
  ranges: PhaseRange[],
  range: PhaseRange,
  lastStartISO: string,
  meanLength: number,
  todayISO: string,
): PhaseTiming => {
  const day = dayOf(todayISO, lastStartISO);
  if (phaseOfDay(ranges, day).key === range.key || day < range.from) {
    return {
      status: day >= range.from ? 'current' : 'upcoming',
      start: addDays(lastStartISO, range.from - 1),
      end: addDays(lastStartISO, range.to - 1),
    };
  }
  return {
    status: 'next',
    start: addDays(lastStartISO, meanLength + range.from - 1),
    end: addDays(lastStartISO, meanLength + range.to - 1),
  };
};

/** Cycle en retard : le jour courant dépasse la fenêtre haute. */
export const isLate = (prediction: Prediction, todayISO: string): boolean => {
  if (!prediction.lastStart || !prediction.windowEnd) return false;
  return todayISO > prediction.windowEnd;
};

/** Cycles hors 21–40 jours : suggérer doucement d'en parler à un médecin (une fois). */
export const isAtypicalLength = (lengthDays: number): boolean =>
  lengthDays < 21 || lengthDays > 40;
