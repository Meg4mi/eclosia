'use client';

import { createContext, useContext, useEffect, useState } from 'react';
// domMax (et non domAnimation) : les gestes drag du bottom sheet en dépendent
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS } from '@/lib/db';
import { getDict, type Dict, type Locale } from '@/i18n';
import type { Settings } from '@/lib/types';
import { SwRegister } from '@/components/SwRegister';

interface AppContextValue {
  settings: Settings;
  dict: Dict;
  locale: Locale;
  reduced: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppShell');
  return ctx;
};

const useSystemReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  // Gate de montage : IndexedDB et la date du jour n'existent qu'au runtime,
  // le HTML prérendu reste une coquille stable (fond, fonts) — pas de mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const settings = useLiveQuery(async () => (await db.settings.get('singleton')) ?? null, [], null);
  const systemReduced = useSystemReducedMotion();

  // <html lang> suit la langue choisie (lecteurs d'écran, césures)
  const locale = (settings ?? DEFAULT_SETTINGS).locale;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (!mounted) return null;

  const effective: Settings = settings ?? DEFAULT_SETTINGS;
  const reduced =
    effective.reducedMotion === 'on' || (effective.reducedMotion === 'system' && systemReduced);

  return (
    <AppContext.Provider value={{ settings: effective, dict: getDict(locale), locale, reduced }}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
          {children}
          <SwRegister />
        </MotionConfig>
      </LazyMotion>
    </AppContext.Provider>
  );
}
