'use client';

/** Note libre du jour — écriture optimiste, débouncée pendant la frappe. */

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { setNote } from '@/lib/logbook';
import type { DailyLog } from '@/lib/types';
import styles from './log.module.css';

export function NoteField({ date, log }: { date: string; log: DailyLog | undefined }) {
  const { dict } = useApp();
  const [value, setValue] = useState(log?.note ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDate = useRef(date);

  // changer de jour recharge la note de ce jour
  useEffect(() => {
    if (lastDate.current !== date) {
      lastDate.current = date;
      setValue(log?.note ?? '');
    }
  }, [date, log?.note]);

  const save = (next: string): void => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void setNote(date, next), 400);
  };

  return (
    <textarea
      className={styles.note}
      placeholder={dict.today.note_placeholder}
      value={value}
      rows={2}
      onChange={(e) => save(e.target.value)}
      onBlur={() => {
        if (timer.current) clearTimeout(timer.current);
        void setNote(date, value);
      }}
    />
  );
}
