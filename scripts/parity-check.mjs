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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';

const PORT = 4199;
const OUT = 'parity-out';
const THRESHOLD_DIAL_PCT = 0.5;
// la feuille est ancrée en bas avec une hauteur fractionnaire : l'anticrénelage
// du texte diffère sous le pixel (bruit ~0,3-0,6 %), qu'aucune translation
// entière ne corrige. Les vraies dérives (fonte, espacement) pèsent 3-5 %.
const THRESHOLD_SHEET_PCT = 1.0;
mkdirSync(OUT, { recursive: true });
copyFileSync('phase-encre-v2.html', 'out/proto.html');

const server = spawn('npx', ['serve', 'out', '-l', String(PORT)], { stdio: 'ignore' });
await new Promise((res) => setTimeout(res, 2500));

const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});

const mkCtx = () =>
  browser.newContext({
    viewport: { width: 410, height: 880 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });

// CSS des fonts self-hostées du build, injecté dans le prototype
const chunkDir = 'out/_next/static/chunks';
const fontCss =
  readdirSync(chunkDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(`${chunkDir}/${f}`, 'utf8'))
    .join('\n')
    .replace(/url\(\.\.\/media\//g, 'url(/_next/static/media/') +
  // dans l'app, next/font pose ces variables sur <html> — le prototype ne les
  // a pas, et le body du CSS global injecté tomberait sur la fonte système
  '\n:root{--font-fraunces:Fraunces;--font-newsreader:Newsreader;}';

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

// ---- feuille de phase (menstruelle) des deux côtés ----
// la section « Tes patterns » diverge par design (patterns réels vs factices) :
// la comparaison s'arrête juste au-dessus, mesurée sur chaque rendu
await proto.evaluate(() => {
  document.querySelectorAll('.hit')[0].dispatchEvent(new Event('click'));
});
await proto.waitForTimeout(1200);
const protoCrop = await proto.evaluate(() => {
  const sheet = document.getElementById('sheet');
  const pt = document.querySelector('.pt-title');
  return Math.floor(pt.getBoundingClientRect().top - sheet.getBoundingClientRect().top);
});
await proto.locator('#sheet').screenshot({ path: `${OUT}/proto-sheet.png` });

await app.locator('svg [role="button"]').first().press('Enter');
await app.getByRole('dialog').waitFor();
await app.waitForTimeout(2600); // stagger du contenu terminé avant capture
const appCrop = await app.evaluate(() => {
  const sheet = document.querySelector('[role="dialog"]');
  const pt = sheet.querySelector('[class*="ptTitle"]');
  return Math.floor(pt.getBoundingClientRect().top - sheet.getBoundingClientRect().top);
});
await app.getByRole('dialog').screenshot({ path: `${OUT}/app-sheet.png` });

// ---- diff pixel (crop optionnel en hauteur, en px CSS) ----
const diffPage = await (await mkCtx()).newPage();
const b64 = (p) => readFileSync(p).toString('base64');
const DPR = 2;

const compare = async (aPath, bPath, outName, cropCss = null) => {
  const result = await diffPage.evaluate(
    async ([a, b, cropDevice]) => {
      const load = (src) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.src = `data:image/png;base64,${src}`;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height, cropDevice ?? Infinity);
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

      // l'ancrage bas + hauteurs fractionnaires décalent parfois tout le
      // contenu d'un pixel : on aligne à ± 2 px device, les vraies
      // divergences ne s'annulent pas par translation
      const measure = (shift) => {
        let sum = 0;
        let over16 = 0;
        const rows = h - Math.abs(shift);
        for (let yy = 0; yy < rows; yy++) {
          const ya = (shift > 0 ? yy : yy - shift) * w * 4;
          const yb = (shift > 0 ? yy + shift : yy) * w * 4;
          for (let x = 0; x < w * 4; x += 4) {
            const d =
              (Math.abs(da[ya + x] - db[yb + x]) +
                Math.abs(da[ya + x + 1] - db[yb + x + 1]) +
                Math.abs(da[ya + x + 2] - db[yb + x + 2])) /
              3;
            sum += d;
            if (d > 16) over16++;
          }
        }
        const n = rows * w;
        return { shift, mean: sum / n, pct: (over16 / n) * 100 };
      };
      let best = measure(0);
      for (const s of [-2, -1, 1, 2]) {
        const m = measure(s);
        if (m.mean < best.mean) best = m;
      }

      // heatmap au meilleur alignement
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const octx = out.getContext('2d');
      const od = octx.createImageData(w, h);
      const s = best.shift;
      for (let yy = 0; yy < h - Math.abs(s); yy++) {
        const ya = (s > 0 ? yy : yy - s) * w * 4;
        const yb = (s > 0 ? yy + s : yy) * w * 4;
        for (let x = 0; x < w * 4; x += 4) {
          const d =
            (Math.abs(da[ya + x] - db[yb + x]) +
              Math.abs(da[ya + x + 1] - db[yb + x + 1]) +
              Math.abs(da[ya + x + 2] - db[yb + x + 2])) /
            3;
          od.data[ya + x] = Math.min(255, d * 4);
          od.data[ya + x + 3] = 255;
        }
      }
      octx.putImageData(od, 0, 0);
      return {
        meanAbs: best.mean.toFixed(3),
        pctOver16: best.pct.toFixed(2),
        shift: best.shift,
        size: `${w}x${h}`,
        png: out.toDataURL('image/png').split(',')[1],
      };
    },
    [b64(aPath), b64(bPath), cropCss === null ? null : cropCss * DPR],
  );
  writeFileSync(`${OUT}/${outName}`, Buffer.from(result.png, 'base64'));
  return result;
};

const dial = await compare(`${OUT}/proto-dial.png`, `${OUT}/app-dial.png`, 'diff-dial.png');
console.log(
  `diff cadran ${dial.size} : écart moyen ${dial.meanAbs}/255, pixels >16 : ${dial.pctOver16}%`,
);
const sheetCrop = Math.min(protoCrop, appCrop) - 4; // marge d'arrondi
const sheet = await compare(
  `${OUT}/proto-sheet.png`,
  `${OUT}/app-sheet.png`,
  'diff-sheet.png',
  sheetCrop,
);
console.log(
  `diff feuille ${sheet.size} : écart moyen ${sheet.meanAbs}/255, pixels >16 : ${sheet.pctOver16}%`,
);

await browser.close();
server.kill();

if (
  Number(dial.pctOver16) > THRESHOLD_DIAL_PCT ||
  Number(sheet.pctOver16) > THRESHOLD_SHEET_PCT
) {
  console.error(
    `ÉCHEC : divergence au-delà des seuils (cadran ${THRESHOLD_DIAL_PCT}%, feuille ${THRESHOLD_SHEET_PCT}%)`,
  );
  process.exit(1);
}
console.log('parité visuelle OK (cadran + feuille)');
