'use client';

/**
 * Transition d'écran (Aujourd'hui ↔ Historique ↔ Réglages) : fondu + léger
 * glissement vertical. L'App Router remonte ce template à chaque navigation.
 */

import { m } from 'motion/react';
import { fade } from '@/lib/motion-tokens';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fade}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100dvh' }}
    >
      {children}
    </m.div>
  );
}
