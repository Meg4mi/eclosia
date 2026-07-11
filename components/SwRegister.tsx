'use client';

/** Enregistre le service worker precache-all (généré au build par scripts/build-sw.mjs). */

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js');
  }, []);
  return null;
}
