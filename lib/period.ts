/**
 * Durée de règles observée — médiane des durées de flow confirmées.
 * Garde-fou « suivi interrompu » : une durée ne compte que si un log existe
 * APRÈS le dernier jour de flow, dans le même cycle — preuve que la saisie a
 * continué et que les règles sont vraiment finies. Sans cela, une saisie
 * abandonnée à J2 ferait passer des règles écourtées pour la vérité.
 */

import { addDays, diffDays } from './dates';
import type { Cycle, DailyLog } from './types';

const MIN_RUN = 2; // un seul jour connu = cycle à peine ouvert, pas une durée
const MAX_RUN = 10; // au-delà, la règle des 10 jours a déjà ouvert un autre cycle
const RECENT_RUNS = 6;

/** null si aucune durée confirmée — le réglage existant reste alors intouché. */
export const observedPeriodLength = (cycles: Cycle[], logs: DailyLog[]): number | null => {
  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const runs: number[] = [];
  for (const c of sorted) {
    const end = c.endDate;
    if (!end) continue;
    const len = diffDays(c.startDate, end) + 1;
    if (len < MIN_RUN || len > MAX_RUN) continue;
    // la confirmation doit venir du même cycle : un log du cycle suivant ne
    // prouve rien sur la fin de celui-ci (l'absence a pu durer tout le cycle)
    const horizon = c.lengthDays != null ? addDays(c.startDate, c.lengthDays - 1) : null;
    const confirmed = logs.some((l) => l.date > end && (horizon === null || l.date <= horizon));
    if (confirmed) runs.push(len);
  }
  const recent = runs.slice(-RECENT_RUNS).sort((a, b) => a - b);
  if (recent.length === 0) return null;
  const mid = recent.length >> 1;
  return recent.length % 2 === 1
    ? (recent[mid] as number)
    : Math.round(((recent[mid - 1] as number) + (recent[mid] as number)) / 2);
};
