'use client';

/** Catalogue complet des symptômes, ouvert par le « + » de la ligne de saisie. */

import { useApp } from '@/components/AppShell';
import { SYMPTOM_IDS } from '@/lib/symptoms';
import { toggleSymptom } from '@/lib/logbook';
import type { DailyLog } from '@/lib/types';
import { SymptomChip } from '@/components/log/chips';
import { NoteField } from '@/components/log/NoteField';
import { BottomSheet } from './BottomSheet';
import styles from './sheet.module.css';

export interface CatalogSheetProps {
  open: boolean;
  date: string;
  log: DailyLog | undefined;
  onClose: () => void;
}

export function CatalogSheet({ open, date, log, onClose }: CatalogSheetProps) {
  const { dict } = useApp();
  const active = new Set(log?.symptoms ?? []);
  const symptomLabels = dict.symptoms as Record<string, string>;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className={styles.eyebrow}>{dict.today.more_symptoms}</div>
      <div className={styles.chipGrid} style={{ marginTop: 14 }}>
        {SYMPTOM_IDS.map((id) => (
          <SymptomChip
            key={id}
            label={symptomLabels[id] ?? id}
            on={active.has(id)}
            onToggle={() => void toggleSymptom(date, id)}
          />
        ))}
      </div>
      <NoteField date={date} log={log} />
    </BottomSheet>
  );
}
