import { expect, test } from '@playwright/test';

/** Parcours secondaires : correction d'un jour passé, changement de langue. */

test('corriger un jour dans l’historique, persistance, langue', async ({ page }) => {
  await page.goto('/');
  const todayNum = String(new Date().getDate());
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await page.getByRole('button', { name: 'commencer' }).click();
  await page.getByText("aujourd'hui, en un geste").waitFor();

  // — historique : cycle en cours visible, correction du jour J1
  await page.getByRole('link', { name: 'historique' }).click();
  await page.getByText('cycle en cours').click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'maux de tête' }).click();
  await dialog.getByPlaceholder('une note pour ce jour, si tu veux').fill('note de test');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  // — persistance après rechargement
  await page.reload();
  await page.getByText('cycle en cours').click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'maux de tête' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(dialog.getByPlaceholder('une note pour ce jour, si tu veux')).toHaveValue(
    'note de test',
  );
  await page.keyboard.press('Escape');

  // — langue : l'app passe en anglais puis revient
  await page.getByRole('link', { name: 'réglages' }).click();
  await page.getByRole('button', { name: 'english' }).click();
  await expect(page.getByRole('link', { name: 'today' })).toBeVisible();
  await page.getByRole('button', { name: 'français' }).click();
  await expect(page.getByRole('link', { name: "aujourd'hui" })).toBeVisible();

  // — la version du build est affichée dans « à propos »
  await expect(page.getByText(/version \d+\.\d+\.\d+ · [0-9a-f]{7} · \d{4}-\d{2}-\d{2}/)).toBeVisible();
});
