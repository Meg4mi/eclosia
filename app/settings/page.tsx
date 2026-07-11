'use client';

/** Réglages (v1) : export/import chiffré, langue, motion, effacement, disclaimer. */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '@/components/AppShell';
import { Nav } from '@/components/nav/Nav';
import { BottomSheet } from '@/components/sheet/BottomSheet';
import { SymptomChip } from '@/components/log/chips';
import { db, saveSettings } from '@/lib/db';
import { eraseAll, mergeImport } from '@/lib/logbook';
import { decryptExport, encryptExport, type ExportData } from '@/lib/crypto';
import { createPinRecord, isValidPin, verifyPin } from '@/lib/pin';
import { UNLOCK_KEY } from '@/components/lock/LockScreen';
import { APP_BUILT_AT, APP_COMMIT, APP_NAME, APP_VERSION, EXPORT_EXTENSION } from '@/lib/config';
import { todayISO } from '@/lib/dates';
import { tpl } from '@/i18n';
import type { Locale } from '@/i18n';
import sheetStyles from '@/components/sheet/sheet.module.css';
import styles from './settings.module.css';

type SheetMode = 'export' | 'import' | 'lock-set' | 'lock-remove' | null;

export default function SettingsPage() {
  const { dict, settings } = useApp();
  const router = useRouter();
  const counts = useLiveQuery(
    async () => ({ cycles: await db.cycles.count(), logs: await db.logs.count() }),
    [],
    undefined,
  );

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [eraseStage, setEraseStage] = useState(0);
  // le bouton d'effacement se désarme tout seul si la confirmation n'arrive pas
  useEffect(() => {
    if (eraseStage === 0) return;
    const t = setTimeout(() => setEraseStage(0), 5000);
    return () => clearTimeout(t);
  }, [eraseStage]);
  const [importRaw, setImportRaw] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ExportData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const closeSheet = (): void => {
    setSheet(null);
    setPass('');
    setPass2('');
    setError(null);
    setFeedback(null);
    setImportRaw(null);
    setImportPreview(null);
  };

  const doExport = async (): Promise<void> => {
    if (pass.length < 8 || busy) return;
    if (pass !== pass2) {
      setError(dict.settings.passphrase_mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data: ExportData = {
        cycles: await db.cycles.toArray(),
        logs: await db.logs.toArray(),
        settings: { locale: settings.locale, avgPeriodLength: settings.avgPeriodLength },
      };
      const raw = await encryptExport(data, pass);
      const blob = new Blob([raw], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eclose-${todayISO()}${EXPORT_EXTENSION}`;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback(dict.settings.export_ready);
    } finally {
      setBusy(false);
    }
  };

  const onFilePicked = async (file: File): Promise<void> => {
    setImportRaw(await file.text());
    setSheet('import');
  };

  const doDecryptPreview = async (): Promise<void> => {
    if (!importRaw || busy) return;
    setBusy(true);
    setError(null);
    try {
      setImportPreview(await decryptExport(importRaw, pass));
    } catch {
      setError(dict.settings.import_error);
    } finally {
      setBusy(false);
    }
  };

  const doMerge = async (): Promise<void> => {
    if (!importPreview || busy) return;
    setBusy(true);
    await mergeImport({
      cycles: importPreview.cycles,
      logs: importPreview.logs,
      settings: importPreview.settings,
    });
    setBusy(false);
    setFeedback(dict.settings.import_done);
    setImportPreview(null);
    setImportRaw(null);
  };

  const doSetPin = async (): Promise<void> => {
    if (!isValidPin(pass) || busy) return;
    if (pass !== pass2) {
      setError(dict.settings.lock_mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    const record = await createPinRecord(pass);
    await saveSettings(record);
    // la session courante reste ouverte, le verrou vaudra au prochain lancement
    sessionStorage.setItem(UNLOCK_KEY, '1');
    setBusy(false);
    setFeedback(dict.settings.lock_done);
    setPass('');
    setPass2('');
  };

  const doRemovePin = async (): Promise<void> => {
    if (pass.length === 0 || busy || !settings.pinHash || !settings.pinSalt) return;
    setBusy(true);
    setError(null);
    const ok = await verifyPin(pass, { pinHash: settings.pinHash, pinSalt: settings.pinSalt });
    if (!ok) {
      setBusy(false);
      setError(dict.settings.lock_wrong);
      return;
    }
    await saveSettings({ pinHash: undefined, pinSalt: undefined });
    sessionStorage.removeItem(UNLOCK_KEY);
    setBusy(false);
    setFeedback(dict.settings.lock_removed);
    setPass('');
  };

  const doErase = async (): Promise<void> => {
    if (eraseStage < 2) {
      setEraseStage(eraseStage + 1);
      return;
    }
    await eraseAll();
    localStorage.removeItem('eclose.notice.atypical');
    localStorage.removeItem('eclose.notice.backup');
    router.push('/');
  };

  return (
    <>
      <div className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>{dict.settings.title}</h1>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.backup}</div>
          <button className={styles.item} onClick={() => setSheet('export')}>
            <span className={styles.itemLabel}>{dict.settings.export}</span>
            <span className={styles.itemDesc} style={{ display: 'block' }}>
              {dict.settings.export_desc}
            </span>
          </button>
          <button className={styles.item} onClick={() => fileRef.current?.click()}>
            <span className={styles.itemLabel}>{dict.settings.import}</span>
            <span className={styles.itemDesc} style={{ display: 'block' }}>
              {tpl(dict.settings.import_desc, { ext: EXPORT_EXTENSION })}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={EXPORT_EXTENSION}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFilePicked(file);
              e.target.value = '';
            }}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.language}</div>
          <div className={styles.choices}>
            {(['fr', 'en'] as Locale[]).map((loc) => (
              <SymptomChip
                key={loc}
                label={loc === 'fr' ? 'français' : 'english'}
                on={settings.locale === loc}
                onToggle={() => void saveSettings({ locale: loc })}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.motion}</div>
          <div className={styles.choices}>
            {(
              [
                // valeur stockée (reducedMotion) → libellé affiché
                ['system', dict.settings.motion_system],
                ['off', dict.settings.motion_on], // animations activées = motion non réduit
                ['on', dict.settings.motion_off], // animations réduites = motion réduit
              ] as const
            ).map(([value, label]) => (
              <SymptomChip
                key={value}
                label={label}
                on={settings.reducedMotion === value}
                onToggle={() => void saveSettings({ reducedMotion: value })}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.lock}</div>
          <button
            className={styles.item}
            onClick={() => setSheet(settings.pinHash ? 'lock-remove' : 'lock-set')}
          >
            <span className={styles.itemLabel}>
              {settings.pinHash ? dict.settings.lock_disable : dict.settings.lock_set}
            </span>
            <span className={styles.itemDesc} style={{ display: 'block' }}>
              {settings.pinHash ? dict.settings.lock_disable_desc : dict.settings.lock_set_desc}
            </span>
          </button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.danger}</div>
          <button className={styles.itemDanger} onClick={() => void doErase()}>
            <span className={`${styles.itemLabel} ${styles.dangerLabel}`}>
              {eraseStage === 0
                ? dict.settings.erase
                : eraseStage === 1
                  ? dict.settings.erase_confirm_1
                  : dict.settings.erase_confirm_2}
            </span>
            <span className={styles.itemDesc} style={{ display: 'block' }}>
              {dict.settings.erase_desc}
            </span>
          </button>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.disclaimer_title}</div>
          <p className={styles.para}>{tpl(dict.settings.disclaimer, { app: APP_NAME })}</p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{dict.settings.about}</div>
          <p className={styles.para}>{tpl(dict.settings.about_text, { app: APP_NAME })}</p>
          <p className={styles.version}>
            {tpl(dict.settings.version, { v: APP_VERSION, c: APP_COMMIT, d: APP_BUILT_AT })}
          </p>
        </section>
      </div>
      <Nav />

      <BottomSheet open={sheet !== null} onClose={closeSheet}>
        {sheet === 'export' && (
          <>
            <div className={sheetStyles.eyebrow}>{dict.settings.export}</div>
            <p className={sheetStyles.range} style={{ marginTop: 8 }}>
              {counts &&
                tpl(dict.settings.import_preview, { cycles: counts.cycles, logs: counts.logs })}
            </p>
            <input
              className={styles.input}
              type="password"
              placeholder={dict.settings.passphrase}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              autoComplete="new-password"
            />
            <input
              className={styles.input}
              type="password"
              placeholder={dict.settings.passphrase_confirm}
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doExport();
              }}
            />
            <p className={styles.feedback}>{dict.settings.passphrase_hint}</p>
            <div className={styles.sheetActions}>
              <button
                className={styles.primary}
                disabled={pass.length < 8 || busy}
                onClick={() => void doExport()}
              >
                {dict.settings.export}
              </button>
              <button className={styles.ghost} onClick={closeSheet}>
                {dict.common.close}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {feedback && <p className={styles.feedback}>{feedback}</p>}
          </>
        )}
        {sheet === 'lock-set' && (
          <>
            <div className={sheetStyles.eyebrow}>{dict.settings.lock_set}</div>
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              placeholder={dict.settings.lock_code}
              value={pass}
              onChange={(e) => setPass(e.target.value.replace(/\D/g, '').slice(0, 8))}
              autoFocus
              autoComplete="off"
              style={{ marginTop: 14 }}
            />
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              placeholder={dict.settings.lock_code_confirm}
              value={pass2}
              onChange={(e) => setPass2(e.target.value.replace(/\D/g, '').slice(0, 8))}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doSetPin();
              }}
            />
            <p className={styles.feedback}>{dict.settings.lock_warning}</p>
            <div className={styles.sheetActions}>
              <button
                className={styles.primary}
                disabled={!isValidPin(pass) || busy}
                onClick={() => void doSetPin()}
              >
                {dict.common.confirm}
              </button>
              <button className={styles.ghost} onClick={closeSheet}>
                {dict.common.cancel}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {feedback && <p className={styles.feedback}>{feedback}</p>}
          </>
        )}
        {sheet === 'lock-remove' && (
          <>
            <div className={sheetStyles.eyebrow}>{dict.settings.lock_disable}</div>
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              placeholder={dict.settings.lock_enter}
              value={pass}
              onChange={(e) => setPass(e.target.value.replace(/\D/g, '').slice(0, 8))}
              autoFocus
              autoComplete="off"
              style={{ marginTop: 14 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doRemovePin();
              }}
            />
            <div className={styles.sheetActions}>
              <button
                className={styles.primary}
                disabled={pass.length === 0 || busy}
                onClick={() => void doRemovePin()}
              >
                {dict.common.confirm}
              </button>
              <button className={styles.ghost} onClick={closeSheet}>
                {dict.common.cancel}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {feedback && <p className={styles.feedback}>{feedback}</p>}
          </>
        )}
        {sheet === 'import' && (
          <>
            <div className={sheetStyles.eyebrow}>{dict.settings.import}</div>
            {!importPreview ? (
              <>
                <input
                  className={styles.input}
                  type="password"
                  placeholder={dict.settings.passphrase}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                  style={{ marginTop: 14 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doDecryptPreview();
                  }}
                />
                <div className={styles.sheetActions}>
                  <button
                    className={styles.primary}
                    disabled={pass.length === 0 || busy}
                    onClick={() => void doDecryptPreview()}
                  >
                    {dict.common.confirm}
                  </button>
                  <button className={styles.ghost} onClick={closeSheet}>
                    {dict.common.cancel}
                  </button>
                </div>
                {error && <p className={styles.error}>{error}</p>}
              </>
            ) : (
              <>
                <h2 className={sheetStyles.title} style={{ fontSize: 30 }}>
                  {tpl(dict.settings.import_preview, {
                    cycles: importPreview.cycles.length,
                    logs: importPreview.logs.length,
                  })}
                </h2>
                <p className={sheetStyles.range}>{dict.settings.import_merge_note}</p>
                <div className={styles.sheetActions}>
                  <button className={styles.primary} disabled={busy} onClick={() => void doMerge()}>
                    {dict.settings.import_confirm}
                  </button>
                  <button className={styles.ghost} onClick={closeSheet}>
                    {dict.common.cancel}
                  </button>
                </div>
              </>
            )}
            {feedback && <p className={styles.feedback}>{feedback}</p>}
          </>
        )}
      </BottomSheet>
    </>
  );
}
