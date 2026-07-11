import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 410, height: 880 }, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'je ne sais plus' }).click();
await page.getByText("aujourd'hui, en un geste").waitFor();
await page.waitForTimeout(600);

// sampler TOUS les divs directs de body + la première chip, pendant la navigation
await page.evaluate(() => {
  window.__s = [];
  const tick = () => {
    const tpl = document.querySelector('body > div'); // wrapper template
    const chip = [...document.querySelectorAll('button')].find((b) => /fatigue|énergie/.test(b.textContent));
    window.__s.push({
      tpl: tpl ? getComputedStyle(tpl).opacity + '/' + getComputedStyle(tpl).transform.slice(0, 24) : 'none',
      chip: chip ? getComputedStyle(chip).opacity : '-',
    });
    if (window.__s.length < 60) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.getByRole('link', { name: 'historique' }).click();
await page.waitForTimeout(300);
await page.getByRole('link', { name: "aujourd'hui" }).click();
await page.waitForTimeout(1000);
const s = await page.evaluate(() => window.__s);
console.log('template opacities:', [...new Set(s.map((x) => x.tpl.split('/')[0]))].join(', '));
console.log('template transforms:', [...new Set(s.map((x) => x.tpl.split('/')[1]))].slice(0, 5).join(' ; '));
console.log('chip opacities pendant navigations:', [...new Set(s.map((x) => x.chip))].join(', '));
await browser.close();
