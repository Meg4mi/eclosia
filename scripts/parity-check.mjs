/**
 * Garde-fou de parité visuelle (§3 du brief) : le cadran du portage doit être
 * indistinguable de phase-encre-v2.html.
 *
 * Méthode : les deux pages sont rendues en prefers-reduced-motion (frame
 * déterministe à t=0 des deux côtés), avec les MÊMES woff2 self-hostés
 * (aucun réseau), même historique de cycles ([29,27,28,30], J16), puis le
 * cadran est comparé pixel à pixel. Échec si > 0,5 % des pixels divergent.
 *
 * Usage : npm run build puis `node scripts/parity-check.mjs`
 * (démarre son propre serveur statique sur :4199). Sorties dans parity-out/.
 */

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const PORT = 4199;
const OUT = 'parity-out';
const THRESHOLD_PCT = 0.5;
mkdirSync(OUT, { recursive: true });
copyFileSync('phase-encre-v2.html', 'out/proto.html');

const server = spawn('npx', ['serve', 'out', '-l', String(PORT)], { stdio: 'ignore' });
await new Promise((res) => setTimeout(res, 2500));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const mkCtx = () =>
  browser.newContext({
    viewport: { width: 410, height: 880 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });

// CSS des fonts self-hostées du build, injecté dans le prototype
const chunkDir = 'out/_next/static/chunks';
const fontCss = readdirSync(chunkDir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(`${chunkDir}/${f}`, 'utf8'))
  .join('\n')
  .replace(/url\(\.\.\/media\//g, 'url(/_next/static/media/');

// ---- prototype de référence ----
const proto = await (await mkCtx()).newPage();
await proto.route('**fonts.googleapis.com**', (r) => r.abort());
await proto.route('**fonts.gstatic.com**', (r) => r.abort());
await proto.goto(`http://localhost:${PORT}/proto.html`);
await proto.addStyleTag({ content: fontCss });
await proto.evaluate(() => document.fonts.ready);
await proto.waitForTimeout(1200);
const protoFonts = await proto.evaluate(() => ({
  fraunces: document.fonts.check('200 92px Fraunces'),
  newsreader: document.fonts.check('italic 300 15px Newsreader'),
}));
if (!protoFonts.fraunces || !protoFonts.newsreader) {
  console.error('fonts non chargées dans le prototype — comparaison invalide');
  process.exit(2);
}
await proto.locator('.dial-wrap').screenshot({ path: `${OUT}/proto-dial.png` });
await proto.screenshot({ path: `${OUT}/proto-full.png` });

// ---- portage, même historique que le prototype ----
const app = await (await mkCtx()).newPage();
await app.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await app.waitForTimeout(1200);
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
    locale: 'fr',
    reducedMotion: 'system',
    avgPeriodLength: 5,
    onboardedAt: 'now',
  });
  await new Promise((res) => {
    tx.oncomplete = res;
  });
  // pas de nudge de sauvegarde pendant la comparaison
  localStorage.setItem('eclose.notice.backup', '1');
});
await app.reload({ waitUntil: 'networkidle' });
await app.getByRole('button', { name: /règles/ }).waitFor();
await app.evaluate(() => document.fonts.ready);
await app.waitForTimeout(1200);
await app.locator('div:has(> canvas)').screenshot({ path: `${OUT}/app-dial.png` });
await app.screenshot({ path: `${OUT}/app-full.png` });

// ---- diff pixel ----
const diffPage = await (await mkCtx()).newPage();
const b64 = (p) => readFileSync(p).toString('base64');
const result = await diffPage.evaluate(
  async ([a, b]) => {
    const load = (src) =>
      new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = `data:image/png;base64,${src}`;
      });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width);
    const h = Math.min(ia.height, ib.height);
    const cv = (img) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, w, h).data;
    };
    const da = cv(ia);
    const db = cv(ib);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    const od = octx.createImageData(w, h);
    let sum = 0;
    let over16 = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d =
        (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
      sum += d;
      if (d > 16) over16++;
      od.data[i] = Math.min(255, d * 4);
      od.data[i + 3] = 255;
    }
    octx.putImageData(od, 0, 0);
    return {
      meanAbs: (sum / (da.length / 4)).toFixed(3),
      pctOver16: ((over16 / (da.length / 4)) * 100).toFixed(2),
      size: `${w}x${h}`,
      png: out.toDataURL('image/png').split(',')[1],
    };
  },
  [b64(`${OUT}/proto-dial.png`), b64(`${OUT}/app-dial.png`)],
);
writeFileSync(`${OUT}/diff.png`, Buffer.from(result.png, 'base64'));
console.log(
  `diff cadran ${result.size} : écart moyen ${result.meanAbs}/255, pixels >16 : ${result.pctOver16}%`,
);

await browser.close();
server.kill();

if (Number(result.pctOver16) > THRESHOLD_PCT) {
  console.error(`ÉCHEC : plus de ${THRESHOLD_PCT}% des pixels divergent du prototype`);
  process.exit(1);
}
console.log('parité visuelle OK');
