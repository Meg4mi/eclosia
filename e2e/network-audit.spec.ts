import { expect, test } from '@playwright/test';

/**
 * Audit « zéro requête réseau » (M3) : la confidentialité radicale est
 * vérifiable — aucune requête ne quitte l'origine, ni au chargement
 * (fonts self-hostées) ni pendant l'usage. Le test échoue si une seule
 * requête externe part.
 */

test('aucune requête externe, du boot à la navigation complète', async ({ page }) => {
  const external: string[] = [];
  const afterBoot: string[] = [];
  let booted = false;

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== 'localhost' && url.protocol !== 'data:') external.push(req.url());
    if (booted && url.hostname !== 'localhost') afterBoot.push(req.url());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  booted = true;

  // parcours complet : onboarding → cadran → navigation → réglages
  // (langue par défaut = anglais, §SEO)
  await page.getByRole('button', { name: "I don't remember" }).click();
  await expect(page.getByText('today, in one gesture')).toBeVisible();
  await page.getByRole('link', { name: 'history' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: 'settings' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: 'today' }).click();
  await page.waitForLoadState('networkidle');

  expect(external, `requêtes externes détectées : ${external.join(', ')}`).toEqual([]);
  expect(afterBoot, `requêtes après le boot : ${afterBoot.join(', ')}`).toEqual([]);
});
