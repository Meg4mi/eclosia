/**
 * Calculs du ruban d'encre et de la géométrie du cadran — purs, testés.
 * Les valeurs (lissage 3 passes, poids .28/.44/.28, opacité d'incertitude)
 * sont celles du prototype phase-encre-v2.html, à l'identique.
 */

import type { PhaseKey, PhaseRange } from './types';
import { phaseOfDay } from './engine';

export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

/**
 * Couleur par jour du cycle, puis lissage circulaire en 3 passes
 * (frontières de phases en dégradé, jamais en coupure nette).
 */
export const ribbonColors = (
  L: number,
  ranges: PhaseRange[],
  palette: Record<PhaseKey, string>,
): RGB[] => {
  let cols: RGB[] = [];
  for (let d = 1; d <= L; d++) cols.push(hexToRgb(palette[phaseOfDay(ranges, d).key]));
  for (let p = 0; p < 3; p++) {
    cols = cols.map((c, i) => {
      const a = cols[(i - 1 + L) % L] as RGB;
      const b = cols[(i + 1) % L] as RGB;
      return c.map((x, k) => (a[k] as number) * 0.28 + x * 0.44 + (b[k] as number) * 0.28) as RGB;
    });
  }
  return cols;
};

/** Ruban neutre du mode découverte : encre pâle uniforme. */
export const neutralColors = (L: number): RGB[] =>
  Array.from({ length: L }, () => [141, 127, 136] as RGB);

/** Opacité d'un jour : l'encre s'estompe dans la fenêtre d'incertitude (d 1-based). */
export const opOf = (d: number, L: number, SD: number): number => {
  const u = L - SD - 1;
  return d > u ? Math.max(0.28, 1 - ((d - u) / (L - u)) * 0.75) : 1;
};

/** Angle d'un jour sur le cadran (J0 en haut, sens horaire), en radians. */
export const angleOf = (d: number, L: number): number => -Math.PI / 2 + (d / L) * Math.PI * 2;

export const pointAt = (a: number, r: number, cx = 200, cy = 200): [number, number] => [
  cx + r * Math.cos(a),
  cy + r * Math.sin(a),
];

/** Chemin d'arc SVG entre deux jours de cycle, au rayon r (viewBox 400×400). */
export const arcPath = (d1: number, d2: number, r: number, L: number): string => {
  const s = angleOf(d1, L);
  const e = angleOf(d2, L);
  const [x1, y1] = pointAt(s, r);
  const [x2, y2] = pointAt(e, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${(d2 - d1) / L > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
};
