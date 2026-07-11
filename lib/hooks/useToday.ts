'use client';

/**
 * Date du jour réactive : une PWA laissée ouverte passé minuit (ou réveillée
 * après une mise en veille) doit re-rendre sur la bonne date — sinon les logs
 * partent sur la veille et le cadran fige.
 */

import { useEffect, useState } from 'react';
import { todayISO } from '@/lib/dates';

export const useToday = (): string => {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const armMidnight = (): void => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        setToday(todayISO());
        armMidnight();
      }, next.getTime() - now.getTime());
    };
    armMidnight();

    // les timers sont gelés en arrière-plan : rattraper au retour au premier plan
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') setToday(todayISO());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
};
