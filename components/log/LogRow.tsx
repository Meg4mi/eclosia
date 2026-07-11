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
  // null : rien · 'saved' : « c'est noté » · 'newCycle' : rebase J1 + annuler
  const [notice, setNotice] = useState<'saved' | 'newCycle' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (kind: 'saved' | 'newCycle' = 'saved'): void => {
    setNotice(kind);
    if (timer.current) clearTimeout(timer.current);
    // un rebase de cycle mérite le temps d'être lu (et annulé)
    timer.current = setTimeout(() => setNotice(null), kind === 'newCycle' ? 8000 : 1400);
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
        <span className={notice ? `${styles.saved} ${styles.savedShow}` : styles.saved}>
          {notice === 'newCycle' ? (
            <>
              {dict.today.new_cycle}{' '}
              <button
                className={styles.undo}
                onClick={() => {
                  void setFlow(date, 0);
                  setNotice(null);
                }}
              >
                {dict.today.undo}
              </button>
            </>
          ) : (
            dict.today.saved
          )}
        </span>
      </div>
      <div className={styles.logRow}>
        <FlowChip
          label={dict.today.flow_chip}
          flow={flow}
          onChange={(next) => {
            void setFlow(date, next).then((res) => {
              if (res.newCycleStarted) flash('newCycle');
            });
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
