/** Catalogue global de symptômes (ids stables) et sélection des chips par phase. */

import { closedCycles, dayOf, phaseOfDay, phases } from './engine';
import type { Cycle, DailyLog, PhaseKey } from './types';

export const SYMPTOM_IDS = [
  'cramps',
  'fatigue',
  'low_mood',
  'high_energy',
  'good_sleep',
  'motivation',
  'libido',
  'ovulation_pain',
  'restless_sleep',
  'irritability',
  'sweet_cravings',
  'headache',
  'bloating',
  'tender_breasts',
  'acne',
  'back_pain',
  'anxiety',
  'focus',
  'digestion',
  'dizziness',
  'insomnia',
  'calm',
] as const;

export type SymptomId = (typeof SYMPTOM_IDS)[number];

export const PHASE_DEFAULTS: Record<PhaseKey, [string, string, string]> = {
  menst: ['cramps', 'fatigue', 'low_mood'],
  foll: ['high_energy', 'good_sleep', 'motivation'],
  ovul: ['high_energy', 'libido', 'ovulation_pain'],
  lute: ['restless_sleep', 'irritability', 'sweet_cravings'],
};

/**
 * Chips adaptatives : dès 2 cycles clos de données, les 3 symptômes réellement
 * les plus loggés dans cette phase remplacent les défauts (complétés par les
 * défauts si moins de 3).
 */
export const symptomsForPhase = (
  phaseKey: PhaseKey,
  cycles: Cycle[],
  logs: DailyLog[],
  avgPeriodLength: number,
): string[] => {
  const closed = closedCycles(cycles);
  if (closed.length < 2) return [...PHASE_DEFAULTS[phaseKey]];

  const counts = new Map<string, number>();
  for (const cycle of closed) {
    const L = cycle.lengthDays as number;
    const ranges = phases(L, avgPeriodLength);
    for (const log of logs) {
      const d = dayOf(log.date, cycle.startDate);
      if (d < 1 || d > L) continue;
      if (phaseOfDay(ranges, d).key !== phaseKey) continue;
      for (const s of log.symptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id]) => id);

  for (const fallback of PHASE_DEFAULTS[phaseKey]) {
    if (top.length >= 3) break;
    if (!top.includes(fallback)) top.push(fallback);
  }
  return top;
};
