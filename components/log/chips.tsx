'use client';

import { useEffect, useRef } from 'react';
import { m } from 'motion/react';
import { fade } from '@/lib/motion-tokens';
import type { Flow } from '@/lib/types';
import styles from './log.module.css';

/**
 * Chips de saisie. Pas d'animation d'entrée : elle rejouait à chaque retour
 * sur l'écran (et deux fois en dev avec le StrictMode) — vécu comme un
 * clignotement. Le prototype n'en avait pas. Restent : l'écrasement au tap
 * (CSS) et la pulsation d'une goutte qui vient de se remplir.
 */

/** Chip règles : l'intensité se cycle en 3 gouttes (0 → 3). */
export function FlowChip({
  label,
  flow,
  onChange,
}: {
  label: string;
  flow: Flow;
  onChange: (next: Flow) => void;
}) {
  // la pulsation ne joue que sur la transition vide → remplie, jamais aux re-rendus
  const prevFlow = useRef(flow);
  useEffect(() => {
    prevFlow.current = flow;
  }, [flow]);

  return (
    <button
      className={flow > 0 ? `${styles.chip} ${styles.chipOn}` : styles.chip}
      onClick={() => onChange(((flow + 1) % 4) as Flow)}
      aria-pressed={flow > 0}
      aria-label={`${label} ${flow}/3`}
    >
      {label}
      <span className={styles.drops}>
        {[0, 1, 2].map((i) => {
          const filled = flow > i;
          const justFilled = filled && prevFlow.current <= i;
          return (
            <m.span
              key={i}
              className={filled ? `${styles.drop} ${styles.dropFilled}` : styles.drop}
              animate={justFilled ? { scale: [1, 1.7, 1] } : { scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          );
        })}
      </span>
    </button>
  );
}

export function SymptomChip({
  label,
  on,
  onToggle,
  enterDelay,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  /** Ondée d'apparition (feuilles ouvertes volontairement) — les chips de la
   * ligne de saisie n'en ont pas : l'entrée rejouerait à chaque navigation. */
  enterDelay?: number;
}) {
  const className = on ? `${styles.chip} ${styles.chipOn}` : styles.chip;
  if (enterDelay === undefined) {
    return (
      <button className={className} onClick={onToggle} aria-pressed={on}>
        {label}
      </button>
    );
  }
  return (
    <m.button
      className={className}
      onClick={onToggle}
      aria-pressed={on}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...fade, duration: 0.3, delay: enterDelay }}
    >
      {label}
    </m.button>
  );
}
