'use client';

/**
 * Bottom sheet générique — comportements natifs (registre feuille système) :
 * - contenu court : toute la feuille suit le doigt (drag Motion) ;
 * - contenu scrollable : il défile naturellement, ET un swipe vers le bas
 *   quand on est en haut du scroll ferme la feuille (pattern iOS). Avec
 *   touch-action:pan-y le navigateur émet pointercancel dès l'intention de
 *   pan, donc ce chemin est piloté par les événements touch (non-passifs)
 *   qui écrivent la même motionValue que le drag Motion ;
 * - la poignée ferme toujours ; Échap et tap sur le fond aussi ;
 * - le fond ne défile jamais pendant qu'une feuille est ouverte ;
 * - courbe unique du prototype (motion-tokens).
 */

import { useEffect, useRef, useState } from 'react';
import {
  animate,
  AnimatePresence,
  m,
  useDragControls,
  useMotionValue,
  type MotionStyle,
} from 'motion/react';
import { fade, sheetTransition } from '@/lib/motion-tokens';
import styles from './sheet.module.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  accent?: string; // couleur locale --sa (feuille de phase)
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, accent, children }: BottomSheetProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue<number | string>(0);
  // contenu plus haut que la feuille : le drag immédiat gênerait le scroll,
  // la fermeture passe alors par « swipe down en haut du scroll » + poignée
  const [scrollable, setScrollable] = useState(false);
  const scrollableRef = useRef(false);
  scrollableRef.current = scrollable;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const el = sheetRef.current;
    const measure = (): void => {
      if (el) setScrollable(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (el) observer.observe(el);

    // verrou du défilement d'arrière-plan, comme une feuille système
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // le focus entre dans la feuille, y reste (Tab cyclique), et revient
    // à l'élément déclencheur à la fermeture
    const previouslyFocused = document.activeElement as HTMLElement | null;
    el?.focus({ preventScroll: true });
    const FOCUSABLE = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const focusables = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (f) => f.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    addEventListener('keydown', onKeyDown);

    // fermeture au doigt sur feuille scrollable : swipe down à scrollTop 0
    let gesture: { startY: number; engaged: boolean; canceled: boolean } | null = null;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;

    const onTouchStart = (e: TouchEvent): void => {
      const touch = e.touches[0];
      if (!touch) return;
      gesture = { startY: touch.clientY, engaged: false, canceled: false };
      lastY = touch.clientY;
      lastT = performance.now();
      velocity = 0;
    };

    const onTouchMove = (e: TouchEvent): void => {
      const touch = e.touches[0];
      if (!el || !gesture || gesture.canceled || !touch || !scrollableRef.current) return;
      const dy = touch.clientY - gesture.startY;
      if (!gesture.engaged) {
        if (el.scrollTop > 0 || dy < -6) {
          gesture.canceled = true; // le geste appartient au scroll du contenu
          return;
        }
        if (dy > 0) e.preventDefault(); // garder la main tant que l'intention est descendante
        if (dy > 6) gesture.engaged = true;
        else return;
      }
      e.preventDefault();
      const now = performance.now();
      velocity = ((touch.clientY - lastY) / Math.max(1, now - lastT)) * 1000;
      lastY = touch.clientY;
      lastT = now;
      y.set(Math.max(0, dy));
    };

    const onTouchEnd = (): void => {
      if (gesture?.engaged) {
        const offset = typeof y.get() === 'number' ? (y.get() as number) : 0;
        if (offset > 70 || velocity > 500) onCloseRef.current();
        else animate(y, 0, sheetTransition);
      }
      gesture = null;
    };

    el?.addEventListener('touchstart', onTouchStart, { passive: true });
    el?.addEventListener('touchmove', onTouchMove, { passive: false });
    el?.addEventListener('touchend', onTouchEnd, { passive: true });
    el?.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
      removeEventListener('keydown', onKeyDown);
      el?.removeEventListener('touchstart', onTouchStart);
      el?.removeEventListener('touchmove', onTouchMove);
      el?.removeEventListener('touchend', onTouchEnd);
      el?.removeEventListener('touchcancel', onTouchEnd);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open, y]);

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
            ref={sheetRef}
            className={styles.sheet}
            style={
              {
                ...(accent ? { '--sa': accent } : null),
                y,
                // laisse le contenu défiler quand la feuille est scrollable
                touchAction: scrollable ? 'pan-y' : 'none',
              } as MotionStyle
            }
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={sheetTransition}
            drag="y"
            dragListener={!scrollable}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 70 || info.velocity.y > 500) onClose();
            }}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
          >
            <div
              className={styles.grabZone}
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden="true"
            />
            <div className={styles.grab} />
            {children}
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
