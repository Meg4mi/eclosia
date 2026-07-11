import { describe, expect, it } from 'vitest';
import { patterns } from '@/lib/patterns';
import { addDays } from '@/lib/dates';
import type { Cycle, DailyLog } from '@/lib/types';

const cycle = (startDate: string, lengthDays?: number): Cycle => ({
  id: startDate,
  startDate,
  lengthDays,
});

const log = (date: string, symptoms: string[]): DailyLog => ({ date, flow: 0, symptoms });

/** 4 cycles clos de 28 j démarrant au 1er janvier. */
const fourCycles = (): Cycle[] => [
  cycle('2026-01-01', 28),
  cycle('2026-01-29', 28),
  cycle('2026-02-26', 28),
  cycle('2026-03-26', 28),
  cycle('2026-04-23'),
];

describe('patterns', () => {
  it('aucun pattern avant 3 cycles clos', () => {
    const cycles = [cycle('2026-01-01', 28), cycle('2026-01-29', 28), cycle('2026-02-26')];
    const logs = [log('2026-01-03', ['cramps']), log('2026-01-31', ['cramps'])];
    expect(patterns(logs, cycles, 5)).toEqual([]);
  });

  it('détecte « sommeil dégradé à J-3 » présent 3 cycles sur 4', () => {
    const cycles = fourCycles();
    // J-3 d'un cycle de 28 j = jour 26 → start + 25 jours
    const logs = [
      log(addDays('2026-01-01', 25), ['restless_sleep']),
      log(addDays('2026-01-29', 25), ['restless_sleep']),
      log(addDays('2026-02-26', 25), ['restless_sleep']),
    ];
    const found = patterns(logs, cycles, 5);
    expect(found).toHaveLength(1);
    const p = found[0]!;
    expect(p.symptomId).toBe('restless_sleep');
    expect(p.mode).toBe('beforePeriod');
    expect(p.day).toBe(3);
    expect(p.count).toBe(3);
    expect(p.total).toBe(4);
    expect(p.phase).toBe('lute');
  });

  it('tolère ± 1 jour de dérive entre cycles', () => {
    const cycles = fourCycles();
    const logs = [
      log(addDays('2026-01-01', 2), ['cramps']), // J3
      log(addDays('2026-01-29', 1), ['cramps']), // J2
      log(addDays('2026-02-26', 3), ['cramps']), // J4
      log(addDays('2026-03-26', 2), ['cramps']), // J3
    ];
    const found = patterns(logs, cycles, 5);
    expect(found.some((p) => p.symptomId === 'cramps' && p.phase === 'menst')).toBe(true);
  });

  it('rejette un symptôme présent dans moins de 60 % des cycles', () => {
    const cycles = fourCycles();
    const logs = [
      log(addDays('2026-01-01', 9), ['headache']),
      log(addDays('2026-01-29', 9), ['headache']),
    ];
    expect(patterns(logs, cycles, 5)).toEqual([]);
  });

  it('max 2 patterns par phase, triés par récurrence', () => {
    const cycles = fourCycles();
    const logs: DailyLog[] = [];
    // trois symptômes récurrents en folliculaire (J8), récurrences 4, 4, 3
    for (const start of ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']) {
      logs.push(log(addDays(start, 7), ['high_energy', 'motivation']));
    }
    for (const start of ['2026-01-01', '2026-01-29', '2026-02-26']) {
      logs.push(log(addDays(start, 8), ['good_sleep']));
    }
    const found = patterns(logs, cycles, 5).filter((p) => p.phase === 'foll');
    expect(found).toHaveLength(2);
    expect(found.every((p) => p.count === 4)).toBe(true);
  });

  it('la formulation est toujours sourçable : count et total exposés', () => {
    const cycles = fourCycles();
    const logs = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'].map((s) =>
      log(addDays(s, 1), ['fatigue']),
    );
    const p = patterns(logs, cycles, 5)[0]!;
    expect(p.count).toBe(4);
    expect(p.total).toBe(4);
  });
});
