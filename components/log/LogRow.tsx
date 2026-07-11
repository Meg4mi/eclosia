'use client';

/**
 * « Aujourd'hui, en un geste » : chip règles à 3 gouttes + 3 pastilles de
 * symptômes adaptées à la phase, + accès au catalogue complet.
 * Écriture optimiste : l'UI n'attend jamais IndexedDB.
 */

import { useRef, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { setFlow, toggleSymptom } from '@/lib/logbook';
import type { DailyLog, Flow } from '@/lib/types';
import { FlowChip, SymptomChip } from './chips';
import styles from './log.module.css';

export interface LogRowProps {
  date: string;
  log: DailyLog | undefined;
  suggestedSymptoms: string[];
  onOpenCatalog: () => void;
}

export function LogRow({ date, log, suggestedSymptoms, onOpenCatalog }: LogRowProps) {
  const { dict } = useApp();
  const [savedVisible, setSavedVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (): void => {
    setSavedVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSavedVisible(false), 1400);
  };

  const flow: Flow = log?.flow ?? 0;
  const active = new Set(log?.symptoms ?? []);
  // les symptômes déjà cochés hors suggestions restent visibles
  const extra = [...active].filter((s) => !suggestedSymptoms.includes(s));
  const symptomLabels = dict.symptoms as Record<string, string>;

  return (
    <div className={styles.log}>
      <div className={styles.logHead}>
        <span className={styles.title}>{dict.today.log_title}</span>
        <span className={savedVisible ? `${styles.saved} ${styles.savedShow}` : styles.saved}>
          {dict.today.saved}
        </span>
      </div>
      <div className={styles.logRow}>
        <FlowChip
          label={dict.today.flow_chip}
          flow={flow}
          onChange={(next) => {
            void setFlow(date, next);
            flash();
          }}
        />
        {[...suggestedSymptoms, ...extra].map((id) => (
          <SymptomChip
            key={id}
            label={symptomLabels[id] ?? id}
            on={active.has(id)}
            onToggle={() => {
              void toggleSymptom(date, id);
              flash();
            }}
          />
        ))}
        <button className={styles.more} onClick={onOpenCatalog} aria-label={dict.today.more_symptoms}>
          +
        </button>
      </div>
    </div>
  );
}
