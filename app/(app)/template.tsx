'use client';

/**
 * Transition d'écran (Aujourd'hui ↔ Historique ↔ Réglages) : fondu + léger
 * glissement vertical. L'App Router remonte ce template à chaque navigation.
 */

import { m } from 'motion/react';
import { screenIn } from '@/lib/motion-tokens';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={screenIn}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100dvh' }}
    >
      {children}
    </m.div>
  );
}
