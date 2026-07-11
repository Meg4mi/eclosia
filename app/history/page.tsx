'use client';

/** Historique (v1) : cycles clos, mini-arc, correction des logs d'un jour passé. */

import { useMemo, useState } from 'react';
import { m } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { fade } from '@/lib/motion-tokens';
import { useApp } from '@/components/AppShell';
import { Nav } from '@/components/nav/Nav';
import { BottomSheet } from '@/components/sheet/BottomSheet';
import { FlowChip, SymptomChip } from '@/components/log/chips';
import { NoteField } from '@/components/log/NoteField';
import { PHASE_COLORS } from '@/components/sheet/PhaseSheet';
import { db } from '@/lib/db';
import { addDays, parseISO } from '@/lib/dates';
import { useToday } from '@/lib/hooks/useToday';
import { dayOf, phases, predict } from '@/lib/engine';
import { arcPath } from '@/lib/ink';
import { SYMPTOM_IDS } from '@/lib/symptoms';
import { setFlow, toggleSymptom } from '@/lib/logbook';
import { formatDate, tpl } from '@/i18n';
import type { Cycle, DailyLog } from '@/lib/types';
import sheetStyles from '@/components/sheet/sheet.module.css';
import styles from './history.module.css';

function MiniArc({ lengthDays, periodLength }: { lengthDays: number; periodLength: number }) {
  const ranges = phases(lengthDays, periodLength);
  return (
    <svg className={styles.arc} width="34" height="34" viewBox="0 0 400 400" aria-hidden="true">
      {ranges.map((p) => (
        <path
          key={p.key}
          d={arcPath(p.from - 1, p.to, 148, lengthDays)}
          stroke={PHASE_COLORS[p.key]}
          strokeWidth={44}
          strokeLinecap="round"
          fill="none"
          opacity={0.8}
        />
      ))}
    </svg>
  );
}

export default function HistoryPage() {
  const { dict, locale, settings } = useApp();
  const today = useToday();
  const cycles = useLiveQuery(() => db.cycles.toArray(), [], undefined);
  const logs = useLiveQuery(() => db.logs.toArray(), [], undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  // une correction peut rebaser le cycle courant : le dire, et pouvoir annuler
  const [rebasedDate, setRebasedDate] = useState<string | null>(null);

  const logByDate = useMemo(() => {
    const map = new Map<string, DailyLog>();
    for (const l of logs ?? []) map.set(l.date, l);
    return map;
  }, [logs]);

  if (cycles === undefined || logs === undefined) return null;

  const sorted = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = sorted.find((c) => c.lengthDays == null && c.startDate <= today);
  const closed = sorted.filter((c) => c.lengthDays != null);

  const editLog = editDate ? logByDate.get(editDate) : undefined;
  const editFlow = editLog?.flow ?? 0;
  const activeSymptoms = new Set(editLog?.symptoms ?? []);
  const symptomLabels = dict.symptoms as Record<string, string>;

  const cycleDays = (cycle: Cycle, length: number): string[] =>
    Array.from({ length }, (_, i) => addDays(cycle.startDate, i)).filter((d) => d <= today);

  const renderCycle = (cycle: Cycle, length: number, meta: string, index: number) => (
    <m.div
      key={cycle.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...fade, delay: Math.min(index, 8) * 0.05 }}
    >
      <button
        className={styles.row}
        onClick={() => setExpanded(expanded === cycle.id ? null : cycle.id)}
        aria-expanded={expanded === cycle.id}
      >
        <MiniArc lengthDays={length} periodLength={settings.avgPeriodLength} />
        <span className={styles.rowBody}>
          <span className={styles.range}>
            {formatDate(parseISO(cycle.startDate), locale)} —{' '}
            {formatDate(parseISO(addDays(cycle.startDate, length - 1)), locale)}
          </span>
          <span className={styles.meta} style={{ display: 'block' }}>
            {meta}
          </span>
        </span>
      </button>
      {expanded === cycle.id && (
        <div className={styles.days}>
          {cycleDays(cycle, length).map((iso) => {
            const l = logByDate.get(iso);
            const cls =
              l && l.flow > 0
                ? styles.dayFlow
                : l && l.symptoms.length > 0
                  ? styles.daySymptom
                  : styles.dayDot;
            return (
              <button key={iso} className={cls} onClick={() => setEditDate(iso)}>
                {dayOf(iso, cycle.startDate)}
              </button>
            );
          })}
        </div>
      )}
    </m.div>
  );

  return (
    <>
      <div className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>{dict.history.title}</h1>
          <span className={styles.hint}>{dict.history.edit_hint}</span>
        </header>

        {closed.length >= 2 &&
          (() => {
            const p = predict(cycles);
            return (
              <p className={styles.stats}>
                {tpl(dict.history.stats, {
                  len: p.meanLength,
                  p: settings.avgPeriodLength,
                  sd: p.sd,
                })}
              </p>
            );
          })()}

        {current &&
          renderCycle(
            current,
            Math.max(dayOf(today, current.startDate), 1),
            dict.history.current,
            0,
          )}
        {closed.map((c, i) =>
          renderCycle(
            c,
            c.lengthDays as number,
            tpl(dict.history.cycle_length, { n: c.lengthDays as number }),
            i + (current ? 1 : 0),
          ),
        )}

        {!current && closed.length === 0 && <p className={styles.empty}>{dict.history.empty}</p>}
      </div>
      <Nav />

      <BottomSheet
        open={editDate !== null}
        onClose={() => {
          setEditDate(null);
          setRebasedDate(null);
        }}
      >
        {editDate && (
          <>
            <div className={sheetStyles.eyebrow}>{dict.history.day_sheet_title}</div>
            <h2 className={sheetStyles.title} style={{ fontSize: 30, marginBottom: 16 }}>
              {formatDate(parseISO(editDate), locale)}
            </h2>
            <div className={sheetStyles.chipGrid}>
              <FlowChip
                label={dict.today.flow_chip}
                flow={editFlow}
                onChange={(next) =>
                  void setFlow(editDate, next).then((res) => {
                    if (res.newCycleStarted) setRebasedDate(editDate);
                  })
                }
              />
            </div>
            {rebasedDate === editDate && (
              <p className={styles.rebaseNotice}>
                {dict.today.new_cycle}{' '}
                <button
                  className={styles.rebaseUndo}
                  onClick={() => {
                    void setFlow(editDate, 0);
                    setRebasedDate(null);
                  }}
                >
                  {dict.today.undo}
                </button>
              </p>
            )}
            <div className={sheetStyles.chipGrid} style={{ marginTop: 12 }}>
              {SYMPTOM_IDS.map((id) => (
                <SymptomChip
                  key={id}
                  label={symptomLabels[id] ?? id}
                  on={activeSymptoms.has(id)}
                  onToggle={() => void toggleSymptom(editDate, id)}
                />
              ))}
            </div>
            <NoteField date={editDate} log={editLog} />
          </>
        )}
      </BottomSheet>
    </>
  );
}
