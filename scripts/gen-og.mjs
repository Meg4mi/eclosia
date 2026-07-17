/**
 * Génère la carte de partage social (Open Graph / Twitter) en local, sans
 * requête réseau : l'anneau d'encre aux quatre couleurs de phase (repris de
 * gen-icons.mjs) + le nom et la signature de l'app, sur fond --bg. Rendu par
 * le Chromium de Playwright puis capturé en 1200×630.
 *
 * Sortie : public/og.png — comme les icônes, l'image est committée (jamais
 * générée au build, jamais requêtée au runtime). Relancer via `npm run gen-og`.
 *
 * Le nom, la signature et les piliers sont lus depuis les sources uniques
 * (lib/config.ts, i18n/en.json — langue par défaut §SEO) plutôt que réécrits
 * en dur (§ nom unique). La
 * police reste une serif système : les fonts de marque (next/font) sont des
 * artefacts de build hors de portée d'un script autonome, et les récupérer
 * violerait la règle « zéro réseau ». Léger décalage typographique assumé sur
 * une carte hors-appareil.
 */

import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Sources uniques : on parse plutôt que de réécrire les littéraux.
const config = readFileSync(path.join(ROOT, 'lib/config.ts'), 'utf8');
const pick = (key) => {
  const m = config.match(new RegExp(`${key}\\s*=\\s*'([^']+)'`));
  if (!m) throw new Error(`introuvable dans lib/config.ts : ${key}`);
  return m[1];
};
const APP_NAME = pick('APP_NAME');
const APP_DESCRIPTION = pick('APP_DESCRIPTION');

const en = JSON.parse(readFileSync(path.join(ROOT, 'i18n/en.json'), 'utf8'));
const pillars = en.discover.pillars.join('  ·  ');

const OUT = path.resolve(ROOT, 'public');
mkdirSync(OUT, { recursive: true });

const W = 1200;
const H = 630;
const RING = 380; // diamètre de l'anneau, colonne de droite

const page = `<!DOCTYPE html><html><head><style>
  html,body{margin:0;padding:0}
  body{
    width:${W}px;height:${H}px;background:#120d14;
    display:flex;align-items:center;justify-content:space-between;
    padding:0 96px;box-sizing:border-box;
    font-family:Georgia,'Times New Roman',serif;color:#fdf8f1;
  }
  .text{display:flex;flex-direction:column;gap:26px;max-width:600px}
  .wordmark{font-size:132px;font-style:italic;line-height:1;letter-spacing:-0.01em}
  .tagline{font-size:44px;line-height:1.25;color:rgba(253,248,241,0.82)}
  .pillars{
    font-family:Arial,Helvetica,sans-serif;font-size:26px;letter-spacing:0.02em;
    color:rgba(253,248,241,0.55);margin-top:8px;
  }
  .ring{flex:0 0 ${RING}px}
</style></head><body>
  <div class="text">
    <div class="wordmark">${APP_NAME}</div>
    <div class="tagline">${APP_DESCRIPTION}</div>
    <div class="pillars">${pillars}</div>
  </div>
  <canvas class="ring" id="c" width="${RING}" height="${RING}"></canvas>
<script>
  const c = document.getElementById('c').getContext('2d');
  const S = ${RING}, cx = S/2, cy = S/2, R = S * 0.34;
  const cols = ['#e2543f','#f0b153','#a678c9','#a9c27a'];
  for (const pass of [0,1]) {
    c.save();
    c.filter = pass === 0 ? 'blur(' + S*0.05 + 'px)' : 'none';
    for (let i = 0; i < 120; i++) {
      const a1 = -Math.PI/2 + (i/120) * Math.PI * 2;
      const a2 = -Math.PI/2 + ((i+1.2)/120) * Math.PI * 2;
      const und = Math.sin(a1*3) * S*0.016 + Math.sin(a1*5) * S*0.008;
      const r = R + (pass === 0 ? und*1.4 : und);
      const w = (pass === 0 ? S*0.1 : S*0.03) * (1 + 0.22*Math.sin(a1*4));
      c.beginPath();
      c.arc(cx, cy, r, a1, a2 + 0.02);
      c.strokeStyle = cols[Math.floor((i/120)*4) % 4];
      c.globalAlpha = pass === 0 ? 0.55 : 0.95;
      c.lineWidth = w; c.lineCap = 'round';
      c.stroke();
    }
    c.restore();
  }
  c.globalAlpha = 1;
  c.beginPath(); c.arc(cx, cy - R, S*0.02, 0, 7);
  c.fillStyle = '#fdf8f1'; c.fill();
</script></body></html>`;

const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const p = await ctx.newPage();
await p.setContent(page);
// attendre que l'anneau contienne réellement de l'encre (pas que du fond)
await p.waitForFunction(() => {
  const cnv = document.getElementById('c');
  const data = cnv.getContext('2d').getImageData(0, 0, cnv.width, cnv.height).data;
  for (let i = 0; i < data.length; i += 400) if (data[i] > 60) return true;
  return false;
});
await p.screenshot({ path: path.join(OUT, 'og.png') });
await ctx.close();
await browser.close();
console.log('généré', 'og.png');
