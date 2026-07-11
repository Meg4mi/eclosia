'use client';

/** L'accent global et la teinte ambiante suivent la phase (transition 1,5 s en CSS). */

import { useEffect } from 'react';
import { hexToRgb } from '@/lib/ink';

export const useAccent = (hex: string | null): void => {
  useEffect(() => {
    const root = document.documentElement;
    if (!hex) {
      root.style.setProperty('--accent', 'var(--muted)');
      root.style.setProperty('--tint', 'rgba(141,127,136,.06)');
      return;
    }
    const [r, g, b] = hexToRgb(hex);
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--tint', `rgba(${r},${g},${b},.08)`);
  }, [hex]);
};
