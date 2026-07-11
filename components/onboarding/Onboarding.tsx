'use client';

/**
 * Première ouverture : une seule question — « Quand ont commencé tes
 * dernières règles ? ». Date picker custom au registre du cadran,
 * ou « je ne sais plus » → mode découverte. Rien d'autre (§7).
 */

import { useMemo, useState } from 'react';
import { m } from 'motion/react';
import { useApp } from '@/components/AppShell';
import { saveSettings } from '@/lib/db';
import { startFirstCycle } from '@/lib/logbook';
import { addDays, todayISO } from '@/lib/dates';
import { APP_NAME } from '@/lib/config';
import { fade } from '@/lib/motion-tokens';
import styles from './onboarding.module.css';

/** Grille d'un mois : lundi en tête, cases vides avant le 1er. */
const monthGrid = (year: number, month: number): (string | null)[] => {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // 0 = lundi
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }
  return cells;
};

export function Onboarding() {
  const { dict, locale } = useApp();
  const today = todayISO();
  const oldest = addDays(today, -90); // trois mois en arrière suffisent
  const [view, setView] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);
  const monthName = new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString(
    locale === 'fr' ? 'fr-FR' : 'en-GB',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );

  const canGoNext = view.year < Number(today.slice(0, 4)) || view.month < Number(today.slice(5, 7)) - 1;
  const canGoPrev = `${view.year}-${String(view.month + 1).padStart(2, '0')}-01` > oldest.slice(0, 8) + '01';

  const move = (delta: number): void =>
    setView(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const finish = async (startDate: string | null): Promise<void> => {
    if (busy) return;
    setBusy(true);
    if (startDate) await startFirstCycle(startDate);
    await saveSettings({ onboardedAt: new Date().toISOString() });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.wordmark}>{APP_NAME}</div>
      <div className={styles.tagline}>{dict.common.tagline}</div>

      <h1 className={styles.question}>{dict.onboarding.question}</h1>
      <p className={styles.hint}>{dict.onboarding.hint}</p>

      <div className={styles.calendar}>
        <div className={styles.monthNav}>
          <button
            className={styles.monthBtn}
            onClick={() => move(-1)}
            disabled={!canGoPrev}
            aria-label="previous month"
          >
            ‹
          </button>
          <span className={styles.monthName}>{monthName}</span>
          <button
            className={styles.monthBtn}
            onClick={() => move(1)}
            disabled={!canGoNext}
            aria-label="next month"
          >
            ›
          </button>
        </div>
        <div className={styles.grid}>
          {dict.onboarding.weekdays.map((w) => (
            <span key={w} className={styles.weekday}>
              {w}
            </span>
          ))}
          {cells.map((iso, i) =>
            iso === null ? (
              <span key={`empty-${i}`} />
            ) : (
              <button
                key={iso}
                className={
                  iso === selected
                    ? styles.daySelected
                    : iso === today
                      ? styles.dayToday
                      : styles.dayCell
                }
                disabled={iso > today || iso < oldest}
                onClick={() => setSelected(iso)}
                aria-pressed={iso === selected}
              >
                {Number(iso.slice(8, 10))}
              </button>
            ),
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {selected && (
          <m.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
            className={styles.start}
            onClick={() => void finish(selected)}
            disabled={busy}
          >
            {dict.onboarding.start}
          </m.button>
        )}
        <button className={styles.unknown} onClick={() => void finish(null)} disabled={busy}>
          {dict.onboarding.unknown}
        </button>
      </div>
    </div>
  );
}
