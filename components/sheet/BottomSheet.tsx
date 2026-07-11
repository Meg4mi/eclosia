'use client';

/**
 * Bottom sheet générique : spring Motion + drag-to-dismiss (remplace le
 * handler touch artisanal du prototype, §2). Une seule courbe, définie dans
 * motion-tokens. useReducedMotion (via MotionConfig) neutralise les springs.
 */

import { AnimatePresence, m } from 'motion/react';
import { fade, sheetSpring } from '@/lib/motion-tokens';
import styles from './sheet.module.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  accent?: string; // couleur locale --sa (feuille de phase)
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, accent, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="backdrop"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
          />
          <m.div
            key="sheet"
            className={styles.sheet}
            style={accent ? ({ '--sa': accent } as React.CSSProperties) : undefined}
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={sheetSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 70 || info.velocity.y > 500) onClose();
            }}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.grab} />
            {children}
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
