'use client';

/**
 * Écran de verrou local. Déverrouillage valable pour la session en cours
 * (sessionStorage) : un redémarrage de l'app redemande le code.
 * Petit délai après un échec — le modèle de menace est un regard indiscret,
 * pas une attaque outillée.
 */

import { useRef, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { verifyPin } from '@/lib/pin';
import { APP_NAME } from '@/lib/config';
import styles from './lock.module.css';

export const UNLOCK_KEY = 'eclose.unlocked';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { dict, settings } = useApp();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tryUnlock = async (pin: string): Promise<void> => {
    if (busy || !settings.pinHash || !settings.pinSalt) return;
    setBusy(true);
    const ok = await verifyPin(pin, { pinHash: settings.pinHash, pinSalt: settings.pinSalt });
    if (ok) {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      onUnlock();
      return;
    }
    setError(true);
    setValue('');
    setTimeout(() => {
      setError(false);
      setBusy(false);
      inputRef.current?.focus();
    }, 800);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.wordmark}>{APP_NAME}</div>
      <label className={styles.prompt} htmlFor="lock-pin">
        {dict.settings.lock_enter}
      </label>
      <input
        id="lock-pin"
        ref={inputRef}
        className={error ? styles.inputError : styles.input}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={value}
        disabled={busy && !error}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 8);
          setValue(next);
          // tentative silencieuse dès 4 chiffres : le bon code ouvre sans Entrée
          if (next.length >= 4 && settings.pinHash && settings.pinSalt) {
            void verifyPin(next, {
              pinHash: settings.pinHash,
              pinSalt: settings.pinSalt,
            }).then((ok) => {
              if (ok) {
                sessionStorage.setItem(UNLOCK_KEY, '1');
                onUnlock();
              }
            });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void tryUnlock(value);
        }}
      />
      <p className={styles.error} aria-live="polite">
        {error ? dict.settings.lock_wrong : ''}
      </p>
    </div>
  );
}
