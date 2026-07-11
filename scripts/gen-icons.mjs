/**
 * Génère les icônes PWA (normales + maskable) en local, sans requête réseau :
 * un anneau d'encre aux quatre couleurs de phase sur fond --bg, rendu par le
 * Chromium de Playwright puis capturé en PNG.
 */

import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'public/icons');
mkdirSync(OUT, { recursive: true });

const page = (size, safe) => `<!DOCTYPE html><html><head><style>
  html,body{margin:0;padding:0}
  body{width:${size}px;height:${size}px;background:#120d14;display:grid;place-items:center}
</style></head><body>
<canvas id="c" width="${size}" height="${size}"></canvas>
<script>
  const c = document.getElementById('c').getContext('2d');
  const S = ${size}, cx = S/2, cy = S/2;
  const R = S * ${safe ? 0.26 : 0.34};
  const cols = ['#e2543f','#f0b153','#a678c9','#a9c27a'];
  c.fillStyle = '#120d14'; c.fillRect(0,0,S,S);
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
for (const [name, size, safe] of [
  ['icon-512.png', 512, false],
  ['icon-192.png', 192, false],
  ['maskable-512.png', 512, true],
  ['maskable-192.png', 192, true],
]) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size } });
  const p = await ctx.newPage();
  await p.setContent(page(size, safe));
  // attendre que le canvas contienne réellement de l'encre (pas que du fond)
  await p.waitForFunction(() => {
    const cnv = document.getElementById('c');
    const data = cnv.getContext('2d').getImageData(0, 0, cnv.width, cnv.height).data;
    for (let i = 0; i < data.length; i += 400) if (data[i] > 60) return true;
    return false;
  });
  await p.screenshot({ path: path.join(OUT, name) });
  await ctx.close();
  console.log('généré', name);
}

await browser.close();
