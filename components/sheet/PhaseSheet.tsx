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
import type { Pattern, PhaseKey, PhaseRange, Prediction } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import styles from './sheet.module.css';

export const PHASE_COLORS: Record<PhaseKey, string> = {
  menst: '#e2543f',
  foll: '#a9c27a',
  ovul: '#f0b153',
  lute: '#a678c9',
};

export interface PhaseSheetProps {
  phase: PhaseRange | null;
  prediction: Prediction;
  patterns: Pattern[];
  closedCount: number;
  onClose: () => void;
}

export function PhaseSheet({ phase, prediction, patterns, closedCount, onClose }: PhaseSheetProps) {
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

  return (
    <BottomSheet open={phase !== null} onClose={onClose} accent={key ? PHASE_COLORS[key] : undefined}>
      {phase && info && (
        <>
          <div className={styles.eyebrow}>{dict.sheet.eyebrow}</div>
          <h2 className={styles.title}>{info.name}</h2>
          <div className={styles.range}>
            {`${dict.common.day}${phase.from} – ${dict.common.day}${phase.to}`}
            {key === 'ovul' &&
              ` · ${tpl(dict.sheet.ovulation_hint, { ov1: ov - 1, ov2: ov })}`}
          </div>
          <div className={styles.desc}>{info.desc}</div>
          <div>
            {info.facts.map(([k, v]) => (
              <div key={k} className={styles.fact}>
                <span className={styles.factK}>{k}</span>
                <span className={styles.factV}>{v}</span>
              </div>
            ))}
          </div>
          <div className={styles.next}>
            {key === 'lute' ? tpl(info.next, { window: windowText }) : info.next}
          </div>
          <div className={styles.ptTitle}>{dict.sheet.patterns_title}</div>
          {closedCount < MIN_CYCLES_FOR_PATTERNS ? (
            <div className={styles.waiting}>
              {tpl(dict.sheet.patterns_waiting, {
                n: missing,
                cycles: missing > 1 ? dict.prediction.cycle_plural : dict.prediction.cycle_singular,
              })}
            </div>
          ) : phasePatterns.length === 0 ? (
            <div className={styles.waiting}>{dict.sheet.patterns_none}</div>
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...fade, delay: 0.12 + i * 0.06 }}
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
