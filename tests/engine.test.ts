import { describe, expect, it } from 'vitest';
import {
  closedCycles,
  dayOf,
  isAtypicalLength,
  isLate,
  ovulationDay,
  phaseOfDay,
  phases,
  phaseTiming,
  predict,
} from '@/lib/engine';
import type { Cycle } from '@/lib/types';

const cycle = (startDate: string, lengthDays?: number): Cycle => ({
  id: startDate,
  startDate,
  lengthDays,
});

describe('predict', () => {
  it('mode découverte : 0 cycle → cadran neutre 28 j, confiance faible', () => {
    const p = predict([]);
    expect(p.meanLength).toBe(28);
    expect(p.sd).toBe(1);
    expect(p.confidence).toBe('faible');
    expect(p.basedOn).toBe(0);
    expect(p.lastStart).toBeNull();
  });

  it('1 cycle ouvert (aucun clos) : prédiction faible sur défaut 28 j', () => {
    const p = predict([cycle('2026-06-01')]);
    expect(p.meanLength).toBe(28);
    expect(p.confidence).toBe('faible');
    expect(p.lastStart).toBe('2026-06-01');
    expect(p.windowStart).toBe('2026-06-28');
    expect(p.windowEnd).toBe('2026-06-30');
  });

  it('1 cycle clos : prédiction faible basée dessus', () => {
    const p = predict([cycle('2026-05-01', 30), cycle('2026-05-31')]);
    expect(p.meanLength).toBe(30);
    expect(p.sd).toBe(1);
    expect(p.confidence).toBe('faible');
    expect(p.basedOn).toBe(1);
  });

  it('2–3 cycles clos : confiance moyenne', () => {
    const p = predict([cycle('2026-04-05', 28), cycle('2026-05-03', 29), cycle('2026-06-01')]);
    expect(p.confidence).toBe('moyenne');
    expect(p.basedOn).toBe(2);
  });

  it('≥ 4 cycles et sd ≤ 2 : confiance élevée, fenêtre = mean ± sd', () => {
    const p = predict([
      cycle('2026-02-01', 29),
      cycle('2026-03-02', 27),
      cycle('2026-03-29', 28),
      cycle('2026-04-26', 30),
      cycle('2026-05-26'),
    ]);
    // mêmes valeurs que le prototype : lengths [29,27,28,30] → L=29, SD=1
    expect(p.meanLength).toBe(29);
    expect(p.sd).toBe(1);
    expect(p.confidence).toBe('élevée');
    expect(p.basedOn).toBe(4);
    expect(p.windowStart).toBe('2026-06-23');
    expect(p.windowEnd).toBe('2026-06-25');
  });

  it('≥ 4 cycles mais sd > 2 : confiance moyenne', () => {
    const p = predict([
      cycle('2026-02-08', 24),
      cycle('2026-03-04', 33),
      cycle('2026-04-06', 26),
      cycle('2026-05-02', 35),
      cycle('2026-06-06'),
    ]);
    expect(p.confidence).toBe('moyenne');
    expect(p.sd).toBeGreaterThan(2);
  });

  it('moyenne sur les 6 derniers cycles clos seulement', () => {
    const cycles = [40, 40, 28, 28, 28, 28, 28, 28].map((len, i) =>
      cycle(`2026-0${(i % 9) + 1}-0${i + 1}`, len),
    );
    const p = predict(cycles);
    expect(p.meanLength).toBe(28);
  });

  it('sd minimum de 1 jour même sur cycles parfaitement réguliers', () => {
    const p = predict([
      cycle('2026-03-10', 28),
      cycle('2026-04-07', 28),
      cycle('2026-05-05', 28),
      cycle('2026-06-02', 28),
    ]);
    expect(p.sd).toBe(1);
  });
});

describe('phases', () => {
  it('découpage du prototype pour L=29, P=5 (ov = 15)', () => {
    const r = phases(29, 5);
    expect(r).toEqual([
      { key: 'menst', from: 1, to: 5 },
      { key: 'foll', from: 6, to: 12 },
      { key: 'ovul', from: 13, to: 16 },
      { key: 'lute', from: 17, to: 29 },
    ]);
    expect(ovulationDay(29)).toBe(15);
  });

  it('reste cohérent sur un cycle court (L=21)', () => {
    const r = phases(21, 5);
    for (const p of r) expect(p.from).toBeLessThanOrEqual(p.to);
    expect(r[3]?.to).toBe(21);
  });

  it('phaseOfDay retombe en lutéale au-delà de L (cycle en retard)', () => {
    const r = phases(28, 5);
    expect(phaseOfDay(r, 35).key).toBe('lute');
    expect(phaseOfDay(r, 1).key).toBe('menst');
    expect(phaseOfDay(r, 14).key).toBe('ovul');
  });
});

describe('phaseTiming', () => {
  // L=29, P=5 : menst 1–5, foll 6–12, ovul 13–16, lute 17–29 — J16 le 2026-06-16
  const r = phases(29, 5);
  const at = (key: 'menst' | 'foll' | 'ovul' | 'lute') =>
    phaseTiming(r, r.find((p) => p.key === key)!, '2026-06-01', 29, '2026-06-16');

  it('phase en cours : bornes du cycle courant', () => {
    expect(at('ovul')).toEqual({ status: 'current', start: '2026-06-13', end: '2026-06-16' });
  });

  it('phase à venir dans ce cycle : ses bornes à venir', () => {
    expect(at('lute')).toEqual({ status: 'upcoming', start: '2026-06-17', end: '2026-06-29' });
  });

  it('phase déjà passée : projetée sur le cycle suivant (lastStart + mean)', () => {
    expect(at('menst')).toEqual({ status: 'next', start: '2026-06-30', end: '2026-07-04' });
    expect(at('foll')).toEqual({ status: 'next', start: '2026-07-05', end: '2026-07-11' });
  });

  it('cycle en retard : la lutéale reste en cours, depuis son début réel', () => {
    const lute = r.find((p) => p.key === 'lute')!;
    expect(phaseTiming(r, lute, '2026-06-01', 29, '2026-07-05')).toEqual({
      status: 'current',
      start: '2026-06-17',
      end: '2026-06-29',
    });
  });
});

describe('dayOf / isLate / isAtypicalLength', () => {
  it('dayOf : J1 = jour du start', () => {
    expect(dayOf('2026-06-01', '2026-06-01')).toBe(1);
    expect(dayOf('2026-06-16', '2026-06-01')).toBe(16);
  });

  it('isLate : vrai seulement après la fenêtre haute', () => {
    const p = predict([
      cycle('2026-03-10', 28),
      cycle('2026-04-07', 28),
      cycle('2026-05-05', 27),
      cycle('2026-06-01'),
    ]);
    expect(isLate(p, '2026-06-30')).toBe(false); // windowEnd = lastStart + mean + sd
    expect(isLate(p, '2026-07-01')).toBe(true);
  });

  it('cycles < 21 j ou > 40 j sont atypiques', () => {
    expect(isAtypicalLength(20)).toBe(true);
    expect(isAtypicalLength(21)).toBe(false);
    expect(isAtypicalLength(40)).toBe(false);
    expect(isAtypicalLength(41)).toBe(true);
  });
});

describe('closedCycles', () => {
  it('filtre et trie chronologiquement', () => {
    const r = closedCycles([cycle('2026-03-01', 28), cycle('2026-04-01'), cycle('2026-02-01', 29)]);
    expect(r.map((c) => c.startDate)).toEqual(['2026-02-01', '2026-03-01']);
  });
});
