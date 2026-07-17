/**
 * Génère les captures d'écran du manifeste (invite d'installation enrichie,
 * Chromium) en local, sans requête réseau : l'app est bâtie, servie depuis
 * out/, amorcée avec un historique factice, puis deux écrans sont capturés —
 * le cadran d'aujourd'hui et une feuille de phase.
 *
 * Sortie : public/screenshots/{today,phase}.png — committées comme les icônes.
 * Le seeding IndexedDB pose un historique factice (cycles [29,27,28,30]).
 *
 * Usage : npm run build puis `npm run gen-shots` (démarre son propre serveur
 * statique sur :4198).
 */

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = 4198;
const OUT = path.resolve(process.cwd(), 'public/screenshots');
mkdirSync(OUT, { recursive: true });

if (!existsSync('out/index.html')) {
  console.error('out/ introuvable — lance `npm run build` avant `npm run gen-shots`');
  process.exit(2);
}

const server = spawn('npx', ['serve', 'out', '-l', String(PORT)], { stdio: 'ignore' });
await new Promise((res) => setTimeout(res, 2500));

const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
const ctx = await browser.newContext({
  viewport: { width: 410, height: 880 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
const app = await ctx.newPage();

await app.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await app.waitForTimeout(1200);

// historique factice : [29,27,28,30], dernier départ à J-15
await app.evaluate(async () => {
  const openReq = indexedDB.open('eclose');
  const d = await new Promise((res, rej) => {
    openReq.onsuccess = () => res(openReq.result);
    openReq.onerror = rej;
  });
  const MS = 864e5;
  const iso = (x) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastStart = new Date(+today - 15 * MS);
  const lengths = [29, 27, 28, 30];
  const tx = d.transaction(['cycles', 'settings'], 'readwrite');
  tx.objectStore('cycles').put({ id: 'cur', startDate: iso(lastStart) });
  let s = lastStart;
  for (let i = lengths.length - 1; i >= 0; i--) {
    s = new Date(+s - lengths[i] * MS);
    tx.objectStore('cycles').put({ id: 'c' + i, startDate: iso(s), lengthDays: lengths[i] });
  }
  tx.objectStore('settings').put({
    id: 'singleton',
    appName: 'Éclose',
    locale: 'en',
    reducedMotion: 'system',
    avgPeriodLength: 5,
    onboardedAt: 'now',
  });
  await new Promise((res) => {
    tx.oncomplete = res;
  });
  // pas de nudge de sauvegarde sur la capture
  localStorage.setItem('eclose.notice.backup', '1');
});

await app.reload({ waitUntil: 'networkidle' });
await app.getByRole('button', { name: /period/i }).waitFor();
await app.evaluate(() => document.fonts.ready);
await app.waitForTimeout(1500);
await app.screenshot({ path: path.join(OUT, 'today.png') });
console.log('généré', 'today.png');

// feuille de phase (ouverte depuis le cadran)
await app.locator('svg [role="button"]').first().press('Enter');
await app.getByRole('dialog').waitFor();
await app.waitForTimeout(2600); // stagger du contenu terminé
await app.screenshot({ path: path.join(OUT, 'phase.png') });
console.log('généré', 'phase.png');

await browser.close();
server.kill();
