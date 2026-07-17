'use client';

/**
 * Feuille de phase : description, faits typiques, « ensuite », Tes patterns.
 * L'accent global glisse vers la couleur de la phase consultée (géré en amont).
 */

import { m } from 'motion/react';
import { useApp } from '@/components/AppShell';
import { fade } from '@/lib/motion-tokens';
import { formatDate, tpl } from '@/i18n';
import { parseISO } from '@/lib/dates';
import { ovulationDay } from '@/lib/engine';
import { MIN_CYCLES_FOR_PATTERNS } from '@/lib/patterns';
import type { Pattern, PhaseKey, PhaseRange, PhaseTiming, Prediction } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import styles from './sheet.module.css';

/** Stagger du contenu de la feuille : chaque bloc se lève à ~50 ms d'écart. */
const arrive = (order: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { ...fade, duration: 0.4, delay: 0.1 + order * 0.05 },
});

export const PHASE_COLORS: Record<PhaseKey, string> = {
  menst: '#e2543f',
  foll: '#a9c27a',
  ovul: '#f0b153',
  lute: '#a678c9',
};

export interface PhaseSheetProps {
  phase: PhaseRange | null;
  timing: PhaseTiming | null;
  prediction: Prediction;
  patterns: Pattern[];
  closedCount: number;
  onClose: () => void;
}

export function PhaseSheet({
  phase,
  timing,
  prediction,
  patterns,
  closedCount,
  onClose,
}: PhaseSheetProps) {
  const { dict, locale } = useApp();
  const key = phase?.key;
  const info = key ? dict.phases[key] : null;
  const ov = ovulationDay(prediction.meanLength);
  const symptomLabels = dict.symptoms as Record<string, string>;

  const windowText =
    prediction.windowStart && prediction.windowEnd
      ? tpl(dict.prediction.window, {
          start: formatDate(parseISO(prediction.windowStart), locale),
          end: formatDate(parseISO(prediction.windowEnd), locale),
        })
      : '';

  const phasePatterns = key ? patterns.filter((p) => p.phase === key) : [];
  const missing = Math.max(1, MIN_CYCLES_FOR_PATTERNS - closedCount);

  const timingTemplate = timing
    ? {
        current: dict.sheet.timing_current,
        upcoming: dict.sheet.timing_upcoming,
        next: dict.sheet.timing_next,
      }[timing.status]
    : null;

  return (
    <BottomSheet open={phase !== null} onClose={onClose} accent={key ? PHASE_COLORS[key] : undefined}>
      {phase && info && (
        <>
          <m.div className={styles.eyebrow} {...arrive(0)}>
            {dict.sheet.eyebrow}
          </m.div>
          <m.h2 className={styles.title} {...arrive(1)}>
            {info.name}
          </m.h2>
          <m.div className={styles.range} {...arrive(2)}>
            {`${dict.common.day}${phase.from} – ${dict.common.day}${phase.to}`}
            {key === 'ovul' &&
              ` · ${tpl(dict.sheet.ovulation_hint, { ov1: ov - 1, ov2: ov })}`}
          </m.div>
          {timing && timingTemplate && (
            <m.div className={styles.timing} {...arrive(3)}>
              {tpl(timingTemplate, { start: formatDate(parseISO(timing.start), locale) })}
            </m.div>
          )}
          <m.div className={styles.desc} {...arrive(4)}>
            {info.desc}
          </m.div>
          <div>
            {info.facts.map(([k, v], i) => (
              <m.div key={k} className={styles.fact} {...arrive(5 + i)}>
                <span className={styles.factK}>{k}</span>
                <span className={styles.factV}>{v}</span>
              </m.div>
            ))}
          </div>
          <m.div className={styles.next} {...arrive(8)}>
            {key === 'lute' ? tpl(info.next, { window: windowText }) : info.next}
          </m.div>
          <m.div className={styles.ptTitle} {...arrive(9)}>
            {dict.sheet.patterns_title}
          </m.div>
          {closedCount < MIN_CYCLES_FOR_PATTERNS ? (
            <m.div className={styles.waiting} {...arrive(10)}>
              {tpl(dict.sheet.patterns_waiting, {
                n: missing,
                cycles: missing > 1 ? dict.prediction.cycle_plural : dict.prediction.cycle_singular,
              })}
            </m.div>
          ) : phasePatterns.length === 0 ? (
            <m.div className={styles.waiting} {...arrive(10)}>
              {dict.sheet.patterns_none}
            </m.div>
          ) : (
            phasePatterns.map((p, i) => {
              const template =
                p.mode === 'fromStart' ? dict.patterns.from_start : dict.patterns.before_period;
              const html = tpl(template, {
                symptom: symptomLabels[p.symptomId] ?? p.symptomId,
                day: p.day,
                k: p.count,
                n: p.total,
              });
              return (
                <m.div
                  key={`${p.symptomId}-${p.mode}`}
                  className={styles.pattern}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...fade, duration: 0.45, delay: 0.6 + i * 0.12 }}
                >
                  {/* contenu issu de nos seuls dictionnaires — pas d'entrée utilisatrice */}
                  <span dangerouslySetInnerHTML={{ __html: html }} />
                  <span className={styles.patternSrc}>
                    {tpl(dict.sheet.pattern_source, { n: p.total })}
                  </span>
                </m.div>
              );
            })
          )}
        </>
      )}
    </BottomSheet>
  );
}
