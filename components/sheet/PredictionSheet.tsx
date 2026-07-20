'use client';

/**
 * Feuille « pourquoi cette fenêtre ? » — rend la prédiction lisible : d'où
 * sort la fourchette, sur combien de cycles, pourquoi cette confiance. Tout
 * vient de l'objet Prediction (+ la tendance) déjà calculés côté Aujourd'hui.
 * Le « cycle moyen » affiché est la vraie moyenne (averageCycleLength), pas la
 * longueur prévue : quand une pente est détectée, on l'explique à part.
 */

import { m } from 'motion/react';
import { useApp } from '@/components/AppShell';
import { fade } from '@/lib/motion-tokens';
import { formatDate, tpl } from '@/i18n';
import { parseISO } from '@/lib/dates';
import type { Trend } from '@/lib/engine';
import type { Prediction } from '@/lib/types';
import { BottomSheet } from './BottomSheet';
import styles from './sheet.module.css';

/** Stagger du contenu : chaque bloc se lève à ~50 ms d'écart (comme PhaseSheet). */
const arrive = (order: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { ...fade, duration: 0.4, delay: 0.1 + order * 0.05 },
});

export interface PredictionSheetProps {
  open: boolean;
  prediction: Prediction;
  trend: Trend | null;
  avgLength: number | null; // la vraie moyenne (« ta moyenne »), pas la prévision
  onClose: () => void;
}

export function PredictionSheet({
  open,
  prediction,
  trend,
  avgLength,
  onClose,
}: PredictionSheetProps) {
  const { dict, locale } = useApp();
  const p = dict.prediction;

  const windowText =
    prediction.windowStart && prediction.windowEnd
      ? tpl(p.window, {
          start: formatDate(parseISO(prediction.windowStart), locale),
          end: formatDate(parseISO(prediction.windowEnd), locale),
        })
      : '';

  const mean = avgLength ?? prediction.meanLength;
  const confReason =
    prediction.confidence === 'faible'
      ? p.why_conf_low
      : prediction.confidence === 'moyenne'
        ? p.why_conf_medium
        : p.why_conf_high;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <m.div className={styles.eyebrow} {...arrive(0)}>
        {p.why_eyebrow}
      </m.div>
      <m.h2 className={styles.title} {...arrive(1)}>
        {p.why_title}
      </m.h2>
      <m.div className={styles.range} {...arrive(2)}>
        {windowText}
      </m.div>

      {prediction.basedOn === 0 ? (
        <m.div className={styles.desc} {...arrive(3)}>
          {tpl(p.why_none, { mean: prediction.meanLength })}
        </m.div>
      ) : (
        <>
          <div>
            <m.div className={styles.fact} {...arrive(3)}>
              <span className={styles.factK}>{p.why_based_label}</span>
              <span className={styles.factV}>{prediction.basedOn}</span>
            </m.div>
            <m.div className={styles.fact} {...arrive(4)}>
              <span className={styles.factK}>{p.why_mean_label}</span>
              <span className={styles.factV}>{tpl(dict.common.days_count, { n: mean })}</span>
            </m.div>
            <m.div className={styles.fact} {...arrive(5)}>
              <span className={styles.factK}>{p.why_reg_label}</span>
              <span className={styles.factV}>± {tpl(dict.common.days_count, { n: prediction.sd })}</span>
            </m.div>
          </div>
          <m.div className={styles.desc} {...arrive(6)} style={{ marginTop: 18 }}>
            {p.why_method}
          </m.div>
          {trend && (
            <m.div className={styles.next} {...arrive(7)}>
              {trend.direction === 'lengthening' ? p.why_trend_longer : p.why_trend_shorter}
            </m.div>
          )}
        </>
      )}

      <m.div className={styles.waiting} {...arrive(8)}>
        {confReason}
      </m.div>
    </BottomSheet>
  );
}
