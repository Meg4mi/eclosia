'use client';

/**
 * Squelette d'instrument sous l'encre — l'overlay SVG du prototype en JSX :
 * graduations hairline (1/jour, majeure /7), labels J1·J8·J15·J22, fenêtre
 * d'incertitude cotée en pointillés, zones tactiles par phase.
 */

import { angleOf, arcPath, pointAt } from '@/lib/ink';
import type { PhaseKey, PhaseRange } from '@/lib/types';
import styles from './dial.module.css';

const RO = 148;
const ang = (d: number, L: number): number => angleOf(d, L);

export interface DialOverlayProps {
  L: number;
  SD: number;
  ranges: PhaseRange[];
  phaseNames: Record<PhaseKey, string>;
  dayLetter: string; // « J » / « D »
  uncertLabel: string;
  showUncert: boolean;
  birth?: boolean; // chorégraphie d'arrivée (désactivée en reduced-motion)
  onPhaseTap: (key: PhaseKey) => void;
}

export function DialOverlay({
  L,
  SD,
  ranges,
  phaseNames,
  dayLetter,
  uncertLabel,
  showUncert,
  birth = false,
  onPhaseTap,
}: DialOverlayProps) {
  const ticks = Array.from({ length: L }, (_, d) => {
    const a = ang(d, L);
    const maj = d % 7 === 0;
    const [x1, y1] = pointAt(a, RO + 22);
    const [x2, y2] = pointAt(a, RO + (maj ? 31 : 26));
    return { x1, y1, x2, y2, maj, d };
  });

  const dayLabels = [1, 8, 15, 22].filter((d) => d <= L);
  const [ux, uy] = pointAt(ang(L - 1, L), RO + 54);

  return (
    <svg
      className={birth ? `${styles.overlay} ${styles.overlayBirth}` : styles.overlay}
      viewBox="0 0 400 400"
      aria-hidden={false}
    >
      {ticks.map(({ x1, y1, x2, y2, maj, d }) => (
        <line
          key={d}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className={maj ? `${styles.gtick} ${styles.gtickMajor}` : styles.gtick}
        />
      ))}
      {dayLabels.map((d) => {
        const [x, y] = pointAt(ang(d - 1, L), RO + 42);
        return (
          <text key={d} x={x} y={y} className={styles.glab}>
            {`${dayLetter}${d}`}
          </text>
        );
      })}
      {showUncert && (
        <>
          <path d={arcPath(L - SD - 1, L, RO + 22, L)} className={styles.uwin} />
          <text x={ux} y={uy} className={styles.uncert}>
            {uncertLabel}
          </text>
        </>
      )}
      {ranges.map((p) => {
        const [x, y] = pointAt(ang((p.from - 1 + p.to) / 2, L), RO - 38);
        return (
          <g key={p.key}>
            <text x={x} y={y + 4} className={styles.plab}>
              {phaseNames[p.key]}
            </text>
            <path
              d={arcPath(p.from - 1, p.to, RO, L)}
              strokeWidth={64}
              className={styles.hit}
              role="button"
              tabIndex={0}
              aria-label={phaseNames[p.key]}
              onClick={() => onPhaseTap(p.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPhaseTap(p.key);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
