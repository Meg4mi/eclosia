import { describe, expect, it } from 'vitest';
import { observedPeriodLength } from '@/lib/period';
import type { Cycle, DailyLog, Flow } from '@/lib/types';

const cycle = (startDate: string, endDate?: string, lengthDays?: number): Cycle => ({
  id: startDate,
  startDate,
  endDate,
  lengthDays,
});

const log = (date: string, flow: Flow = 0, symptoms: string[] = []): DailyLog => ({
  date,
  flow,
  symptoms,
});

describe('observedPeriodLength', () => {
  it('médiane des durées confirmées par un log ultérieur du même cycle', () => {
    const cycles = [
      cycle('2026-03-01', '2026-03-05', 28), // 5 j
      cycle('2026-03-29', '2026-04-01', 28), // 4 j
      cycle('2026-04-26', '2026-04-29', 30), // 4 j
      cycle('2026-05-26'), // cycle courant, pas de flow
    ];
    const logs = [
      log('2026-03-07', 0, ['fatigue']),
      log('2026-04-03', 0, ['cramps']),
      log('2026-05-02', 0, ['fatigue']),
    ];
    expect(observedPeriodLength(cycles, logs)).toBe(4);
  });

  it('une saisie abandonnée après le flow ne compte pas (règles peut-être pas finies)', () => {
    const cycles = [
      cycle('2026-03-01', '2026-03-06', 28), // 6 j, confirmé
      cycle('2026-03-29', '2026-03-30', 28), // 2 j puis plus rien : suivi interrompu
      cycle('2026-04-26'),
    ];
    const logs = [
      log('2026-03-08', 0, ['fatigue']), // confirme le premier cycle
      // aucun log après le 2026-03-30 dans le second cycle
    ];
    expect(observedPeriodLength(cycles, logs)).toBe(6);
  });

  it('un log du cycle suivant ne confirme pas le cycle précédent', () => {
    const cycles = [
      cycle('2026-03-01', '2026-03-02', 28), // 2 j puis silence tout le cycle
      cycle('2026-03-29', '2026-03-29'),
    ];
    // seul log ultérieur : J1 du cycle suivant — hors horizon du premier
    expect(observedPeriodLength(cycles, [log('2026-03-29', 2)])).toBeNull();
  });

  it('le cycle courant (sans longueur) est confirmable par tout log ultérieur', () => {
    const cycles = [cycle('2026-05-26', '2026-05-30')];
    expect(observedPeriodLength(cycles, [log('2026-06-02', 0, ['calm'])])).toBe(5);
    expect(observedPeriodLength(cycles, [])).toBeNull();
  });

  it('durées hors 2–10 jours écartées ; médiane robuste aux extrêmes', () => {
    const cycles = [
      cycle('2026-01-01', '2026-01-01', 28), // 1 j : cycle à peine ouvert
      cycle('2026-01-29', '2026-02-02', 28), // 5 j
      cycle('2026-02-26', '2026-03-02', 28), // 5 j
      cycle('2026-03-26', '2026-03-27', 28), // 2 j (vraie durée courte, confirmée)
      cycle('2026-04-23'),
    ];
    const logs = [
      log('2026-01-03', 0, ['fatigue']),
      log('2026-02-04', 0, ['fatigue']),
      log('2026-03-04', 0, ['fatigue']),
      log('2026-03-29', 0, ['fatigue']),
    ];
    // durées confirmées : [5, 5, 2] → médiane 5 (le 2 isolé ne tire pas vers le bas)
    expect(observedPeriodLength(cycles, logs)).toBe(5);
  });

  it('médiane sur nombre pair : moyenne des deux du milieu, arrondie', () => {
    const cycles = [
      cycle('2026-01-01', '2026-01-04', 28), // 4 j
      cycle('2026-01-29', '2026-02-03', 28), // 6 j
      cycle('2026-02-26'),
    ];
    const logs = [log('2026-01-06'), log('2026-02-05')];
    expect(observedPeriodLength(cycles, logs)).toBe(5);
  });
});
