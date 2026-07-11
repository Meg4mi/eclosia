/**
 * Moteur de patterns (§8) — volontairement simple et explicable.
 * Un pattern : « tel symptôme revient à telle position », présent dans ≥ 60 %
 * des cycles clos (min 3), fenêtre de ± 1 jour. Jamais causal, jamais prescriptif.
 */

import { closedCycles, dayOf, phaseOfDay, phases } from './engine';
import type { Cycle, DailyLog, Pattern, PhaseKey } from './types';

export const MIN_CYCLES_FOR_PATTERNS = 3;
const THRESHOLD = 0.6;
const BEFORE_WINDOW = 7; // J-1 … J-7 avant les règles suivantes
const MAX_PER_PHASE = 2;

interface Candidate {
  symptomId: string;
  mode: 'fromStart' | 'beforePeriod';
  day: number;
  count: number;
  exact: number; // cycles où le jour correspond sans la tolérance ± 1
}

/** À récurrence égale, la position au plus de correspondances exactes gagne
 * (sinon la fenêtre ± 1 « étale » le pattern sur les jours voisins). */
const better = (a: Candidate, b: Candidate | null): boolean =>
  !b || a.count > b.count || (a.count === b.count && a.exact > b.exact);

/** Jours de cycle (1-based) où le symptôme apparaît, pour un cycle clos donné. */
const daysWithSymptom = (cycle: Cycle, L: number, logs: DailyLog[], symptom: string): Set<number> => {
  const days = new Set<number>();
  for (const log of logs) {
    if (!log.symptoms.includes(symptom)) continue;
    const d = dayOf(log.date, cycle.startDate);
    if (d >= 1 && d <= L) days.add(d);
  }
  return days;
};

export const patterns = (logs: DailyLog[], cycles: Cycle[], avgPeriodLength: number): Pattern[] => {
  const closed = closedCycles(cycles).slice(-8); // l'historique récent porte le pattern
  const total = closed.length;
  if (total < MIN_CYCLES_FOR_PATTERNS) return [];

  const allSymptoms = new Set<string>();
  for (const log of logs) for (const s of log.symptoms) allSymptoms.add(s);

  const meanLength = Math.round(
    closed.reduce((s, c) => s + (c.lengthDays as number), 0) / total,
  );
  const meanRanges = phases(meanLength, avgPeriodLength);
  const minRequired = Math.ceil(total * THRESHOLD);

  const candidates: Candidate[] = [];

  for (const symptom of allSymptoms) {
    const perCycle = closed.map((c) => ({
      L: c.lengthDays as number,
      days: daysWithSymptom(c, c.lengthDays as number, logs, symptom),
    }));

    // positions J1…Jn depuis le début, fenêtre ± 1 jour
    let bestFromStart: Candidate | null = null;
    for (let p = 1; p <= meanLength; p++) {
      const count = perCycle.filter(
        ({ days }) => days.has(p) || days.has(p - 1) || days.has(p + 1),
      ).length;
      const exact = perCycle.filter(({ days }) => days.has(p)).length;
      const candidate: Candidate = { symptomId: symptom, mode: 'fromStart', day: p, count, exact };
      if (count >= minRequired && better(candidate, bestFromStart)) bestFromStart = candidate;
    }

    // positions J-1…J-7 avant les règles suivantes (fin du cycle clos)
    let bestBefore: Candidate | null = null;
    for (let q = 1; q <= BEFORE_WINDOW; q++) {
      const dayFor = (L: number): number => L - q + 1; // J-q = q-ième jour avant le start suivant
      const count = perCycle.filter(({ L, days }) => {
        const d = dayFor(L);
        return days.has(d) || days.has(d - 1) || days.has(d + 1);
      }).length;
      const exact = perCycle.filter(({ L, days }) => days.has(dayFor(L))).length;
      const candidate: Candidate = { symptomId: symptom, mode: 'beforePeriod', day: q, count, exact };
      if (count >= minRequired && better(candidate, bestBefore)) bestBefore = candidate;
    }

    // un seul pattern par symptôme : le plus récurrent, J-n préféré à égalité
    // (plus parlant, et évite de décrire deux fois la même occurrence)
    if (bestBefore && (!bestFromStart || bestBefore.count >= bestFromStart.count)) {
      candidates.push(bestBefore);
    } else if (bestFromStart) {
      candidates.push(bestFromStart);
    }
  }

  const withPhase: Pattern[] = candidates.map(({ symptomId, mode, day, count }) => {
    const cycleDay = mode === 'fromStart' ? day : meanLength - day + 1;
    return { symptomId, mode, day, count, total, phase: phaseOfDay(meanRanges, cycleDay).key };
  });

  // max 2 par phase, triés par récurrence
  const byPhase = new Map<PhaseKey, Pattern[]>();
  for (const p of withPhase) {
    const list = byPhase.get(p.phase) ?? [];
    list.push(p);
    byPhase.set(p.phase, list);
  }
  const out: Pattern[] = [];
  for (const list of byPhase.values()) {
    list.sort((a, b) => b.count - a.count || a.day - b.day);
    out.push(...list.slice(0, MAX_PER_PHASE));
  }
  return out;
};
