import { expect, test } from '@playwright/test';

/** Verrou local : code demandé à chaque nouvelle session, mauvais code refusé. */

test('définir un code, verrouillage au redémarrage, déverrouillage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'je ne sais plus' }).click();

  // — définir le code
  await page.getByRole('link', { name: 'réglages' }).click();
  await page.getByRole('button', { name: /définir un code/ }).click();
  await page.getByPlaceholder('code (4 chiffres ou plus)').fill('4321');
  await page.getByPlaceholder('encore une fois').fill('4321');
  await page.getByRole('dialog').getByRole('button', { name: 'confirmer' }).click();
  await expect(page.getByText("c'est verrouillé")).toBeVisible();
  // la session courante reste ouverte
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: "aujourd'hui" }).click();
  await expect(page.getByText("aujourd'hui, en un geste")).toBeVisible();

  // — nouvelle session : verrouillée
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByLabel('ton code')).toBeVisible();

  // — mauvais code : refusé, on reste verrouillée
  await page.getByLabel('ton code').fill('9999');
  await page.keyboard.press('Enter');
  await expect(page.getByText("ce n'est pas le bon code")).toBeVisible();

  // — bon code : l'app s'ouvre (dès la saisie, sans Entrée)
  await page.getByLabel('ton code').fill('4321');
  await expect(page.getByText("aujourd'hui, en un geste")).toBeVisible();
});
