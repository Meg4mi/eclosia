'use client';

import { m } from 'motion/react';
import { chipIn } from '@/lib/motion-tokens';
import type { Flow } from '@/lib/types';
import styles from './log.module.css';

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
  return (
    <m.button
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={chipIn}
      className={flow > 0 ? `${styles.chip} ${styles.chipOn}` : styles.chip}
      onClick={() => onChange(((flow + 1) % 4) as Flow)}
      aria-pressed={flow > 0}
      aria-label={`${label} ${flow}/3`}
    >
      {label}
      <span className={styles.drops}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={flow > i ? `${styles.drop} ${styles.dropFilled}` : styles.drop} />
        ))}
      </span>
    </m.button>
  );
}

export function SymptomChip({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <m.button
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={chipIn}
      className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
      onClick={onToggle}
      aria-pressed={on}
    >
      {label}
    </m.button>
  );
}
