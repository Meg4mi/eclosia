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

    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (disposed) return;
      if (reg.waiting) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const fresh = reg.installing;
        fresh?.addEventListener('statechange', () => {
          // « installed » avec un contrôleur actif = nouvelle version en attente
          if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(fresh);
          }
        });
      });
      // revenir au premier plan déclenche une vérification de mise à jour
      const onVisible = (): void => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', onVisible);
    });

    return () => {
      disposed = true;
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
