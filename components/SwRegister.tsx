'use client';

/**
 * Enregistre le service worker precache-all et signale les mises à jour :
 * quand une nouvelle version attend (le SW ne fait jamais de skipWaiting
 * automatique), une ligne discrète propose de recharger. Le tap active le
 * nouveau SW puis recharge dès qu'il prend le contrôle — jamais de page
 * orpheline de ses chunks.
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import styles from './sw-update.module.css';

export function SwRegister() {
  const { dict } = useApp();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let disposed = false;
    let onVisible: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    // un worker déjà « installed » et en attente, contrôleur actif présent :
    // nouvelle version prête. Remontée idempotente, appelée depuis plusieurs
    // signaux (Safari ne déclenche pas `updatefound` de façon fiable).
    const surfaceWaiting = (reg: ServiceWorkerRegistration): void => {
      if (!disposed && reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
    };

    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (disposed) return;
      surfaceWaiting(reg);
      reg.addEventListener('updatefound', () => {
        const fresh = reg.installing;
        // course possible : le worker peut déjà être passé « waiting »
        if (!fresh) {
          surfaceWaiting(reg);
          return;
        }
        fresh.addEventListener('statechange', () => {
          if (fresh.state === 'installed' && navigator.serviceWorker.controller) setWaiting(fresh);
        });
      });

      // Vérifications de mise à jour redondantes : les checks implicites du
      // navigateur ne sont pas fiables (surtout iOS/Safari). On force `update()`
      // au montage, au retour au premier plan et périodiquement — chaque check
      // re-scrute `reg.waiting` au cas où le worker serait déjà passé en attente
      // sans que `updatefound` ait été capté.
      const check = (): void => {
        void reg
          .update()
          .then(() => surfaceWaiting(reg))
          .catch(() => undefined);
      };
      check();
      onVisible = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisible);
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') check();
      }, 60_000);
    });

    return () => {
      disposed = true;
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
      if (interval) clearInterval(interval);
    };
  }, []);

  const applyUpdate = (): void => {
    if (!waiting) return;
    // recharger seulement quand le nouveau SW contrôle la page
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage('SKIP_WAITING');
    setWaiting(null);
  };

  if (!waiting) return null;

  return (
    <button className={styles.toast} onClick={applyUpdate}>
      {dict.common.update_ready} · <span className={styles.action}>{dict.common.update_action}</span>
    </button>
  );
}
