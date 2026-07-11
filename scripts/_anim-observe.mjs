import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// motion NON réduit explicitement — comme un téléphone normal
const ctx = await browser.newContext({ viewport: { width: 410, height: 880 }, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'je ne sais plus' }).click();
await page.getByText("aujourd'hui, en un geste").waitFor();

// — 1. naissance du ruban : le canvas doit avoir une animation CSS au montage
const birth = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { anim: getComputedStyle(c).animationName, dur: getComputedStyle(c).animationDuration };
});
console.log('1. naissance du ruban :', JSON.stringify(birth));

// — 2. transition d'écran : échantillonner opacity/transform pendant une navigation
const sample = await page.evaluate(() => {
  window.__samples = [];
  const tick = () => {
    const el = document.querySelector('body > div > div'); // template wrapper
    if (el) {
      const cs = getComputedStyle(el);
      window.__samples.push(cs.opacity + '|' + cs.transform.slice(0, 30));
    }
    if (window.__samples.length < 40) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
});
await page.getByRole('link', { name: 'historique' }).click();
await page.waitForTimeout(800);
const samples = await page.evaluate(() => window.__samples);
const opacities = [...new Set(samples.map((s) => s.split('|')[0]))];
console.log('2. transition écran — opacités échantillonnées :', opacities.slice(0, 8).join(', '), opacities.length > 1 ? '→ ANIME' : '→ PAS D\'ANIMATION VISIBLE');

// — 3. clignotement des chips : revenir, échantillonner l'opacité d'une chip pendant des taps
await page.getByRole('link', { name: "aujourd'hui" }).click();
const chip = page.getByRole('button', { name: 'fatigue' });
await chip.waitFor();
await page.waitForTimeout(600);
await page.evaluate(() => {
  const chips = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('fatigue'));
  window.__chip = [];
  const el = chips[0];
  const tick = () => {
    window.__chip.push(getComputedStyle(el).opacity + '|' + getComputedStyle(el).transform.slice(0, 22));
    if (window.__chip.length < 90) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
// taper sur une AUTRE chip et sur règles pendant l'échantillonnage
await page.getByRole('button', { name: /règles/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /règles/ }).click();
await page.waitForTimeout(900);
const chipSamples = await page.evaluate(() => window.__chip);
const chipOpac = [...new Set(chipSamples.map((s) => s.split('|')[0]))];
const chipTrans = [...new Set(chipSamples.map((s) => s.split('|')[1]))];
console.log('3. chip « fatigue » pendant taps sur règles — opacités distinctes :', chipOpac.join(', '));
console.log('   transforms distincts :', chipTrans.slice(0, 6).join(' ; '), chipTrans.length > 3 ? `(${chipTrans.length} valeurs → ÇA BOUGE)` : '');
await browser.close();
