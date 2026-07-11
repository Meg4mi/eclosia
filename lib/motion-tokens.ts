/**
 * Grammaire d'animation (§6) : une seule courbe de sheet, une seule durée de
 * fade, réutilisées partout. Registre « organique calme » — stiffness basse,
 * damping élevé, jamais de bounce marqué.
 */

import type { Transition } from 'motion/react';

/** Équivalent spring du cubic-bezier(.32,.72,.28,1) 480 ms du prototype. */
export const sheetSpring: Transition = { type: 'spring', stiffness: 240, damping: 32, mass: 0.9 };

/** Fondu unique (backdrop, apparitions discrètes) — .35s comme le prototype. */
export const fade: Transition = { duration: 0.35, ease: 'easeOut' };

/** Micro-interaction des chips : tap déjà couvert par le CSS (:active scale .96),
 * l'apparition passe par ce ressort discret. */
export const chipIn: Transition = { type: 'spring', stiffness: 300, damping: 30 };
