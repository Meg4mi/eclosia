/**
 * Empreinte symptômes × jour de cycle — comptages purs pour la heatmap de
 * l'historique. Même fenêtre que les patterns : les 8 derniers cycles clos.
 * Largeur = longueur moyenne arrondie ; les jours au-delà (cycles plus longs)
 * sortent du cadre plutôt que d'être repliés — approximation assumée, la
 * position exacte relève du moteur de patterns.
 */

import { closedCycles, dayOf } from './engine';
import type { Cycle, DailyLog } from './types';

export const MIN_CYCLES_FOR_HEATMAP = 2;
export const MAX_HEATMAP_ROWS = 6;
const MIN_OCCURRENCES = 2; // un symptôme vu une seule fois n'est pas une texture
const RECENT_CYCLES = 8;

export interface HeatmapRow {
  symptomId: string;
  total: number; // occurrences comptées, toutes cases confondues
  counts: number[]; // index 0 = J1 ; nb de cycles où le symptôme est loggé ce jour-là
}

export interface Heatmap {
  days: number; // largeur : longueur moyenne arrondie des cycles retenus
  cycles: number; // nb de cycles clos comptés
  max: number; // comptage max d'une case (échelle d'opacité)
  rows: HeatmapRow[]; // du plus loggé au moins loggé
}

/** null tant qu'il n'y a pas assez de matière (cycles clos ou symptômes récurrents). */
export const heatmap = (logs: DailyLog[], cycles: Cycle[]): Heatmap | null => {
  const closed = closedCycles(cycles).slice(-RECENT_CYCLES);
  if (closed.length < MIN_CYCLES_FOR_HEATMAP) return null;

  const days = Math.round(
    closed.reduce((s, c) => s + (c.lengthDays as number), 0) / closed.length,
  );

  const byId = new Map<string, number[]>();
  for (const log of logs) {
    if (log.symptoms.length === 0) continue;
    const cycle = closed.find(
      (c) => log.date >= c.startDate && dayOf(log.date, c.startDate) <= (c.lengthDays as number),
    );
    if (!cycle) continue;
    const d = dayOf(log.date, cycle.startDate);
    if (d > days) continue;
    for (const s of log.symptoms) {
      const counts = byId.get(s) ?? Array.from({ length: days }, () => 0);
      counts[d - 1] = (counts[d - 1] ?? 0) + 1;
      byId.set(s, counts);
    }
  }

  const rows: HeatmapRow[] = [...byId.entries()]
    .map(([symptomId, counts]) => ({
      symptomId,
      counts,
      total: counts.reduce((a, b) => a + b, 0),
    }))
    .filter((r) => r.total >= MIN_OCCURRENCES)
    .sort((a, b) => b.total - a.total || a.symptomId.localeCompare(b.symptomId))
    .slice(0, MAX_HEATMAP_ROWS);

  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => Math.max(...r.counts)));
  return { days, cycles: closed.length, max, rows };
};
