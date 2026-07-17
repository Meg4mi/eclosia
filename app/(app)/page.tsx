'use client';

/** Aujourd'hui — le cadran, la prédiction honnête, la saisie en un geste. */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, m } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { fade } from '@/lib/motion-tokens';
import { useApp } from '@/components/AppShell';
import { InkRing } from '@/components/dial/InkRing';
import { DialOverlay } from '@/components/dial/DialOverlay';
import { DialCenter } from '@/components/dial/DialCenter';
import { LogRow } from '@/components/log/LogRow';
import { PhaseSheet, PHASE_COLORS } from '@/components/sheet/PhaseSheet';
import { CatalogSheet } from '@/components/sheet/CatalogSheet';
import { Nav } from '@/components/nav/Nav';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { db } from '@/lib/db';
import { parseISO } from '@/lib/dates';
import { useToday } from '@/lib/hooks/useToday';
import {
  closedCycles,
  cycleTrend,
  dayOf,
  isAtypicalLength,
  isLate,
  ovulationDay,
  phaseByKey,
  phaseOfDay,
  phases,
  phaseTiming,
  predict,
} from '@/lib/engine';
import { INK_COLORS, neutralColors, ribbonColors } from '@/lib/ink';
import { patterns as computePatterns } from '@/lib/patterns';
import { symptomsForPhase } from '@/lib/symptoms';
import { useAccent } from '@/lib/hooks/useAccent';
import { APP_NAME } from '@/lib/config';
import { formatDate, formatFullDate, formatShortDate, tpl } from '@/i18n';
import type { PhaseKey } from '@/lib/types';
import dialStyles from '@/components/dial/dial.module.css';
import styles from './today.module.css';

const DISMISSED = {
  atypical: 'eclose.notice.atypical',
  backup: 'eclose.notice.backup',
  // une clé par direction : si la dérive s'inverse plus tard, l'info revient
  trendLonger: 'eclose.notice.trend.lengthening',
  trendShorter: 'eclose.notice.trend.shortening',
} as const;

export default function TodayPage() {
  const { settings, dict, locale, reduced } = useApp();
  const today = useToday();

  const cycles = useLiveQuery(() => db.cycles.toArray(), [], undefined);
  const log = useLiveQuery(() => db.logs.get(today), [today], undefined);
  const logs = useLiveQuery(() => db.logs.toArray(), [], undefined);

  const [openPhase, setOpenPhase] = useState<PhaseKey | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(() =>
    Object.values(DISMISSED).filter((k) => typeof window !== 'undefined' && localStorage.getItem(k)),
  );

  const prediction = useMemo(() => predict(cycles ?? []), [cycles]);
  const trend = useMemo(() => cycleTrend(cycles ?? []), [cycles]);

  // raccourci PWA « Logger aujourd'hui » : /?log=1 ouvre le catalogue de saisie.
  // Les réglages arrivent d'IndexedDB après le premier rendu : on retient la
  // demande et on ouvre dès que l'app se sait onboardée.
  const [wantsLog, setWantsLog] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('log'),
  );
  useEffect(() => {
    if (!wantsLog || !settings.onboardedAt) return;
    setCatalogOpen(true);
    setWantsLog(false);
    window.history.replaceState(null, '', window.location.pathname);
  }, [wantsLog, settings.onboardedAt]);
  const discovery = (cycles ?? []).length === 0;
  const L = prediction.meanLength;
  const SD = prediction.sd;
  const ranges = useMemo(() => phases(L, settings.avgPeriodLength), [L, settings.avgPeriodLength]);
  const closed = useMemo(() => closedCycles(cycles ?? []), [cycles]);
  const allPatterns = useMemo(
    () => computePatterns(logs ?? [], cycles ?? [], settings.avgPeriodLength),
    [logs, cycles, settings.avgPeriodLength],
  );

  const todayDay = prediction.lastStart ? dayOf(today, prediction.lastStart) : null;
  const currentPhase = todayDay !== null ? phaseOfDay(ranges, todayDay) : null;
  const late = isLate(prediction, today);

  const colors = useMemo(
    () => (discovery ? neutralColors(L) : ribbonColors(L, ranges, INK_COLORS)),
    [discovery, L, ranges],
  );

  const sheetPhase = openPhase ? phaseByKey(ranges, openPhase) : null;
  const sheetTiming =
    sheetPhase && prediction.lastStart
      ? phaseTiming(ranges, sheetPhase, prediction.lastStart, L, today)
      : null;

  // les quatre phases avec leur date d'arrivée, en ordre chronologique depuis aujourd'hui
  const lastStart = prediction.lastStart;
  const phaseStrip = useMemo(
    () =>
      lastStart
        ? ranges
            .map((r) => ({ range: r, timing: phaseTiming(ranges, r, lastStart, L, today) }))
            .sort((a, b) => a.timing.start.localeCompare(b.timing.start))
        : null,
    [ranges, lastStart, L, today],
  );
  const accentKey = openPhase ?? currentPhase?.key ?? null;
  useAccent(accentKey ? PHASE_COLORS[accentKey] : null);

  const suggested = useMemo(
    () =>
      symptomsForPhase(
        currentPhase?.key ?? 'menst',
        cycles ?? [],
        logs ?? [],
        settings.avgPeriodLength,
        L,
      ),
    [currentPhase?.key, cycles, logs, settings.avgPeriodLength, L],
  );

  // chargement initial d'IndexedDB (<50 ms) : la coquille reste stable, rien ne clignote
  if (cycles === undefined || logs === undefined) return null;
  if (!settings.onboardedAt) return <Onboarding />;

  const ov = ovulationDay(L);
  const phaseNames = Object.fromEntries(
    (Object.keys(dict.phases) as PhaseKey[]).map((k) => [k, dict.phases[k].name]),
  ) as Record<PhaseKey, string>;

  const windowText =
    prediction.windowStart && prediction.windowEnd
      ? tpl(dict.prediction.window, {
          start: formatDate(parseISO(prediction.windowStart), locale),
          end: formatDate(parseISO(prediction.windowEnd), locale),
        })
      : '';
  const [predBefore = '', predAfter = ''] = dict.prediction.line.split('{window}');

  const levelWord =
    prediction.confidence === 'faible'
      ? dict.prediction.level_low
      : prediction.confidence === 'moyenne'
        ? dict.prediction.level_medium
        : dict.prediction.level_high;
  const confText =
    prediction.basedOn === 1
      ? tpl(dict.prediction.confidence_one, { level: levelWord })
      : tpl(dict.prediction.confidence, {
          level: levelWord,
          n: prediction.basedOn,
          cycles: dict.prediction.cycle_plural,
        });

  const centerCtx = discovery
    ? dict.today.discovery_ctx
    : late
      ? dict.today.late
      : currentPhase?.key === 'ovul'
        ? tpl(dict.phases.ovul.ctx, { ov1: ov - 1, ov2: ov })
        : (currentPhase && dict.phases[currentPhase.key].ctx) || '';

  const lastClosed = closed[closed.length - 1];
  const showAtypical =
    lastClosed?.lengthDays != null &&
    isAtypicalLength(lastClosed.lengthDays) &&
    !dismissed.includes(DISMISSED.atypical);
  const trendKey =
    trend?.direction === 'lengthening' ? DISMISSED.trendLonger : DISMISSED.trendShorter;
  const showTrend = trend !== null && !showAtypical && !dismissed.includes(trendKey);
  const showBackupNudge =
    !showAtypical && !showTrend && closed.length >= 2 && !dismissed.includes(DISMISSED.backup);

  const dismiss = (key: string): void => {
    localStorage.setItem(key, '1');
    setDismissed((d) => [...d, key]);
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.wordmark}>{APP_NAME}</div>
        <div className={styles.date}>{formatFullDate(parseISO(today), locale)}</div>
      </header>
      <div className={dialStyles.dialWrap}>
        <InkRing
          colors={colors}
          L={L}
          SD={SD}
          todayDay={todayDay}
          reduced={reduced}
          fadeWindow={!discovery}
        />
        <DialOverlay
          L={L}
          SD={SD}
          ranges={ranges}
          phaseNames={phaseNames}
          dayLetter={dict.common.day}
          uncertLabel={dict.prediction.uncert_label}
          showUncert={!discovery}
          birth={!reduced}
          onPhaseTap={setOpenPhase}
        />
        <DialCenter
          phaseName={discovery ? dict.today.discovery_phase : (currentPhase && phaseNames[currentPhase.key]) || ''}
          dayLetter={dict.common.day}
          dayNumber={todayDay}
          context={centerCtx}
          birth={!reduced}
        />
      </div>

      <div className={styles.prediction}>
        {/* la fenêtre qui se resserre après un log arrive en fondu */}
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={discovery ? 'discovery' : `${windowText}·${confText}`}
            style={{ display: 'block' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={fade}
          >
            {discovery ? (
              dict.today.discovery_prediction
            ) : (
              <>
                {predBefore}
                <em className={styles.predictionEm}>{windowText}</em>
                {predAfter}
                <span className={styles.conf}>{confText}</span>
              </>
            )}
          </m.span>
        </AnimatePresence>
      </div>

      {phaseStrip && (
        <div className={styles.phasesGrid}>
          {phaseStrip.map(({ range, timing }) => (
            <button
              key={range.key}
              className={styles.phaseItem}
              onClick={() => setOpenPhase(range.key)}
            >
              <span
                className={styles.phaseDot}
                style={{ background: PHASE_COLORS[range.key] }}
                aria-hidden="true"
              />
              <span className={styles.phaseName}>{phaseNames[range.key]}</span>
              <span className={styles.phaseDate}>
                {timing.status === 'current'
                  ? dict.today.phase_now
                  : timing.start <= today
                    ? dict.today.phase_soon
                    : tpl(dict.today.phase_around, {
                        date: formatShortDate(parseISO(timing.start), locale),
                      })}
              </span>
            </button>
          ))}
        </div>
      )}

      {showAtypical && (
        <div className={styles.notice}>
          {dict.prediction.long_or_short}
          <button className={styles.noticeDismiss} onClick={() => dismiss(DISMISSED.atypical)}>
            ✕
          </button>
        </div>
      )}
      {showTrend && trend && (
        <div className={styles.notice}>
          {trend.direction === 'lengthening'
            ? dict.prediction.trend_longer
            : dict.prediction.trend_shorter}
          <button className={styles.noticeDismiss} onClick={() => dismiss(trendKey)}>
            ✕
          </button>
        </div>
      )}
      {showBackupNudge && (
        <div className={styles.notice}>
          <Link href="/settings/" className={styles.noticeLink}>
            {dict.settings.backup_nudge}
          </Link>
          <button className={styles.noticeDismiss} onClick={() => dismiss(DISMISSED.backup)}>
            ✕
          </button>
        </div>
      )}

      <LogRow
        date={today}
        log={log}
        suggestedSymptoms={suggested}
        onOpenCatalog={() => setCatalogOpen(true)}
      />

      <Nav />

      <PhaseSheet
        phase={sheetPhase}
        timing={sheetTiming}
        prediction={prediction}
        patterns={allPatterns}
        closedCount={closed.length}
        onClose={() => setOpenPhase(null)}
      />
      <CatalogSheet
        open={catalogOpen}
        date={today}
        log={log}
        onClose={() => setCatalogOpen(false)}
      />
    </>
  );
}
