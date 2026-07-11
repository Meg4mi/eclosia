import { describe, expect, it } from 'vitest';
import { angleOf, arcPath, hexToRgb, neutralColors, opOf, ribbonColors } from '@/lib/ink';
import { phases } from '@/lib/engine';

const PALETTE = {
  menst: '#e2543f',
  foll: '#a9c27a',
  ovul: '#f0b153',
  lute: '#a678c9',
} as const;

describe('hexToRgb', () => {
  it('convertit les couleurs des tokens', () => {
    expect(hexToRgb('#e2543f')).toEqual([226, 84, 63]);
    expect(hexToRgb('#120d14')).toEqual([18, 13, 20]);
  });
});

describe('ribbonColors', () => {
  it('produit une couleur par jour, lissée (jamais de coupure nette)', () => {
    const L = 29;
    const cols = ribbonColors(L, phases(L, 5), PALETTE);
    expect(cols).toHaveLength(L);
    // les frontières sont des dégradés : deux jours voisins restent proches
    for (let i = 0; i < L; i++) {
      const a = cols[i]!;
      const b = cols[(i + 1) % L]!;
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect(dist).toBeLessThan(80);
    }
    // le lissage 3 passes conserve la dominante de chaque phase
    const j3 = cols[2]!; // plein cœur menstruel
    expect(j3[0]).toBeGreaterThan(j3[1]); // rouge dominant
  });

  it('mode découverte : ruban neutre uniforme', () => {
    const cols = neutralColors(28);
    expect(cols).toHaveLength(28);
    expect(new Set(cols.map((c) => c.join(','))).size).toBe(1);
  });
});

describe('opOf (fondu de la fenêtre d’incertitude)', () => {
  it('opacité pleine avant la fenêtre, fondu ensuite, plancher à .28', () => {
    const L = 29;
    const SD = 1;
    expect(opOf(1, L, SD)).toBe(1);
    expect(opOf(L - SD - 1, L, SD)).toBe(1);
    expect(opOf(L - SD, L, SD)).toBeLessThan(1);
    expect(opOf(L, L, SD)).toBeGreaterThanOrEqual(0.28);
    expect(opOf(L, L, SD)).toBeLessThan(0.5);
  });
});

describe('géométrie du cadran', () => {
  it('angleOf : J0 en haut (−π/2), quart de cycle à droite', () => {
    expect(angleOf(0, 28)).toBeCloseTo(-Math.PI / 2);
    expect(angleOf(7, 28)).toBeCloseTo(0);
  });

  it('arcPath : grand arc marqué au-delà du demi-cycle', () => {
    expect(arcPath(0, 10, 148, 28)).toContain(' 0 0 1 ');
    expect(arcPath(0, 20, 148, 28)).toContain(' 0 1 1 ');
  });
});
