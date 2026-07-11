'use client';

import styles from './dial.module.css';

export interface DialCenterProps {
  phaseName: string;
  dayLetter: string;
  dayNumber: number | null; // null en mode découverte
  context: string;
  birth?: boolean; // chorégraphie d'arrivée (désactivée en reduced-motion)
}

export function DialCenter({ phaseName, dayLetter, dayNumber, context, birth = false }: DialCenterProps) {
  return (
    <div className={birth ? `${styles.center} ${styles.centerBirth}` : styles.center}>
      <div className={styles.phaseName}>{phaseName}</div>
      <div className={styles.day}>
        {dayNumber !== null ? (
          <>
            <span className={styles.dayJ}>{dayLetter}</span>
            {dayNumber}
          </>
        ) : (
          <span aria-hidden="true">·</span>
        )}
      </div>
      <div className={styles.context}>{context}</div>
    </div>
  );
}
