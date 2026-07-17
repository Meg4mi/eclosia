import { describe, expect, it } from 'vitest';
import { heatmap, MAX_HEATMAP_ROWS } from '@/lib/heatmap';
import { addDays } from '@/lib/dates';
import type { Cycle, DailyLog, Flow } from '@/lib/types';

const cycle = (startDate: string, lengthDays?: number): Cycle => ({
  id: startDate,
  startDate,
  lengthDays,
});

const log = (date: string, symptoms: string[], flow: Flow = 0): DailyLog => ({
  date,
  flow,
  symptoms,
});

// deux cycles clos de 28 j : 2026-03-01 et 2026-03-29
const TWO_CYCLES = [cycle('2026-03-01', 28), cycle('2026-03-29', 28), cycle('2026-04-26')];

describe('heatmap', () => {
  it('null sous 2 cycles clos', () => {
    expect(heatmap([log('2026-03-02', ['cramps'])], [cycle('2026-03-01')])).toBeNull();
  });

  it('null sans symptôme récurrent (une seule occurrence)', () => {
    expect(heatmap([log('2026-03-02', ['cramps'])], TWO_CYCLES)).toBeNull();
  });

  it('compte par jour de cycle, sur la largeur moyenne', () => {
    const hm = heatmap(
      [
        log('2026-03-02', ['cramps']), // cycle 1, J2
        log('2026-03-30', ['cramps']), // cycle 2, J2
        log('2026-04-01', ['cramps']), // cycle 2, J4
      ],
      TWO_CYCLES,
    );
    expect(hm).not.toBeNull();
    expect(hm?.days).toBe(28);
    expect(hm?.cycles).toBe(2);
    expect(hm?.max).toBe(2);
    expect(hm?.rows).toHaveLength(1);
    expect(hm?.rows[0]?.symptomId).toBe('cramps');
    expect(hm?.rows[0]?.total).toBe(3);
    expect(hm?.rows[0]?.counts[1]).toBe(2); // J2 dans les deux cycles
    expect(hm?.rows[0]?.counts[3]).toBe(1); // J4 une fois
  });

  it('les logs hors cycles clos (cycle courant, avant l\'historique) sont ignorés', () => {
    const hm = heatmap(
      [
        log('2026-02-15', ['cramps']), // avant le premier cycle clos
        log('2026-04-27', ['cramps']), // cycle courant, non clos
        log('2026-03-02', ['fatigue']),
        log('2026-03-30', ['fatigue']),
      ],
      TWO_CYCLES,
    );
    expect(hm?.rows).toHaveLength(1);
    expect(hm?.rows[0]?.symptomId).toBe('fatigue');
  });

  it('un jour au-delà de la largeur moyenne sort du cadre', () => {
    // cycles de 28 et 32 j → moyenne 30 : le J31 du cycle long est hors cadre
    const cycles = [cycle('2026-03-01', 28), cycle('2026-03-29', 32), cycle('2026-04-30')];
    const hm = heatmap(
      [
        log(addDays('2026-03-29', 30), ['bloating']), // J31 du cycle de 32 j
        log('2026-03-05', ['bloating']),
        log('2026-04-02', ['bloating']),
      ],
      cycles,
    );
    expect(hm?.days).toBe(30);
    expect(hm?.rows[0]?.total).toBe(2);
  });

  it('trie par total décroissant et plafonne le nombre de lignes', () => {
    const symptoms = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const logs: DailyLog[] = [];
    // le symptôme i apparaît (i+2) fois, réparties sur les deux cycles
    symptoms.forEach((s, i) => {
      for (let k = 0; k <= i + 1; k++) {
        const start = k % 2 === 0 ? '2026-03-01' : '2026-03-29';
        logs.push(log(addDays(start, Math.floor(k / 2) + i), [s]));
      }
    });
    const hm = heatmap(logs, TWO_CYCLES);
    expect(hm?.rows).toHaveLength(MAX_HEATMAP_ROWS);
    expect(hm?.rows[0]?.symptomId).toBe('g'); // le plus loggé en premier
    expect(hm?.rows.map((r) => r.symptomId)).not.toContain('a'); // le moins loggé exclu
  });
});
