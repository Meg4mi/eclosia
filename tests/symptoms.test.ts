import { describe, expect, it } from 'vitest';
import { PHASE_DEFAULTS, SYMPTOM_IDS, symptomsForPhase } from '@/lib/symptoms';
import { addDays } from '@/lib/dates';
import type { Cycle, DailyLog } from '@/lib/types';

const cycle = (startDate: string, lengthDays?: number): Cycle => ({
  id: startDate,
  startDate,
  lengthDays,
});
const log = (date: string, symptoms: string[]): DailyLog => ({ date, flow: 0, symptoms });

describe('catalogue', () => {
  it('une vingtaine de symptômes aux ids stables, défauts par phase inclus', () => {
    expect(SYMPTOM_IDS.length).toBeGreaterThanOrEqual(20);
    for (const trio of Object.values(PHASE_DEFAULTS)) {
      for (const id of trio) expect(SYMPTOM_IDS).toContain(id);
    }
  });
});

describe('symptomsForPhase', () => {
  it('défauts de phase avant 2 cycles clos', () => {
    expect(symptomsForPhase('menst', [cycle('2026-01-01')], [], 5)).toEqual([
      'cramps',
      'fatigue',
      'low_mood',
    ]);
  });

  it('dès 2 cycles : les 3 symptômes réellement les plus loggés dans la phase', () => {
    const cycles = [cycle('2026-01-01', 28), cycle('2026-01-29', 28), cycle('2026-02-26')];
    const logs: DailyLog[] = [];
    for (const start of ['2026-01-01', '2026-01-29']) {
      logs.push(log(addDays(start, 1), ['headache', 'back_pain', 'anxiety'])); // J2 menst
      logs.push(log(addDays(start, 2), ['headache', 'back_pain'])); // J3 menst
      logs.push(log(addDays(start, 9), ['calm'])); // folliculaire : ne compte pas
    }
    const chips = symptomsForPhase('menst', cycles, logs, 5);
    expect(chips.slice(0, 2)).toEqual(['back_pain', 'headache']);
    expect(chips).toContain('anxiety');
    expect(chips).toHaveLength(3);
  });

  it('complète avec les défauts si moins de 3 symptômes observés', () => {
    const cycles = [cycle('2026-01-01', 28), cycle('2026-01-29', 28), cycle('2026-02-26')];
    const logs = [log('2026-01-02', ['headache']), log('2026-01-30', ['headache'])];
    const chips = symptomsForPhase('menst', cycles, logs, 5);
    expect(chips[0]).toBe('headache');
    expect(chips).toHaveLength(3);
    expect(chips).toContain('cramps');
  });
});
