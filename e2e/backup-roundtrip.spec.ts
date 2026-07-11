import { expect, test } from '@playwright/test';

/**
 * Le seul mécanisme de sauvegarde : export chiffré → effacement total →
 * import → tout revient. Si ce parcours casse, des données réelles sont
 * perdues — il est testé de bout en bout.
 */

test('export chiffré, effacement, import : les données reviennent', async ({ page }) => {
  await page.goto('/');

  // — données : onboarding aujourd'hui + un symptôme
  const todayNum = String(new Date().getDate());
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await page.getByRole('button', { name: 'commencer' }).click();
  await page.getByRole('button', { name: 'fatigue' }).click();

  // — export
  await page.getByRole('link', { name: 'réglages' }).click();
  await page.getByRole('button', { name: /exporter mes données/ }).click();
  await page.getByPlaceholder('phrase secrète', { exact: true }).fill('phrase de test e2e');
  await page.getByPlaceholder('encore une fois').fill('phrase de test e2e');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'exporter mes données' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  await page.keyboard.press('Escape');

  // — effacement total (double confirmation)
  await page.getByRole('button', { name: 'tout effacer' }).click();
  await page.getByRole('button', { name: 'effacer, vraiment ?' }).click();
  await page.getByRole('button', { name: /dernière confirmation/ }).click();
  await expect(page.getByText('Quand ont commencé tes dernières règles ?')).toBeVisible();

  // — import : préviu puis fusion
  await page.goto('/settings');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /importer un fichier/ }).click();
  await (await chooser).setFiles(filePath);
  await page.getByPlaceholder('phrase secrète').fill('phrase de test e2e');
  await page.getByRole('dialog').getByRole('button', { name: 'confirmer' }).click();
  await expect(page.getByText(/1 cycles, 1 jours de logs/)).toBeVisible();
  await page.getByRole('button', { name: 'fusionner' }).click();
  await expect(page.getByText("c'est importé")).toBeVisible();
  await page.keyboard.press('Escape'); // fermer la feuille avant de naviguer

  // — tout est revenu : cadran à J1, symptôme coché
  await page.getByRole('link', { name: "aujourd'hui" }).click();
  await expect(page.getByRole('button', { name: 'fatigue' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
