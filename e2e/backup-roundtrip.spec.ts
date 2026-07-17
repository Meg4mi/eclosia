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
  await page.getByRole('button', { name: 'begin' }).click();
  await page.getByRole('button', { name: 'fatigue' }).click();

  // — export
  await page.getByRole('link', { name: 'settings' }).click();
  await page.getByRole('button', { name: /export my data/ }).click();
  await page.getByPlaceholder('secret phrase', { exact: true }).fill('phrase de test e2e');
  await page.getByPlaceholder('once more').fill('phrase de test e2e');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'export my data' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  await page.keyboard.press('Escape');

  // — effacement total (double confirmation)
  await page.getByRole('button', { name: 'erase everything' }).click();
  await page.getByRole('button', { name: 'erase, really?' }).click();
  await page.getByRole('button', { name: /last confirmation/ }).click();
  await expect(page.getByText('When did your last period start?')).toBeVisible();

  // — import : préviu puis fusion
  await page.goto('/settings');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import a file/ }).click();
  await (await chooser).setFiles(filePath);
  await page.getByPlaceholder('secret phrase').fill('phrase de test e2e');
  await page.getByRole('dialog').getByRole('button', { name: 'confirm' }).click();
  await expect(page.getByText(/1 cycles, 1 days of logs/)).toBeVisible();
  await page.getByRole('button', { name: 'merge' }).click();
  await expect(page.getByText('imported')).toBeVisible();
  await page.keyboard.press('Escape'); // fermer la feuille avant de naviguer

  // — tout est revenu : cadran à J1, symptôme coché
  await page.getByRole('link', { name: 'today' }).click();
  await expect(page.getByRole('button', { name: 'fatigue' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
