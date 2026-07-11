/**
 * Grammaire d'animation (§6) : une seule courbe de sheet, une seule durée de
 * fade, réutilisées partout. Registre « organique calme » — stiffness basse,
 * damping élevé, jamais de bounce marqué.
 */

import type { Transition } from 'motion/react';

/** LA courbe de sheet — celle du prototype, à l'identique :
 * cubic-bezier(.32,.72,.28,1) sur 480 ms. Le drag-to-dismiss Motion s'y ajoute. */
export const sheetTransition: Transition = { duration: 0.48, ease: [0.32, 0.72, 0.28, 1] };

/** Fondu unique (backdrop, apparitions discrètes) — .35s comme le prototype. */
export const fade: Transition = { duration: 0.35, ease: 'easeOut' };

/** Arrivée d'un écran : même courbe que la feuille, plus ample que le fondu. */
export const screenIn: Transition = { duration: 0.5, ease: [0.32, 0.72, 0.28, 1] };
