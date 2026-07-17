import { expect, test } from '@playwright/test';

/** Parcours secondaires : correction d'un jour passé, changement de langue. */

test('corriger un jour dans l’historique, persistance, langue', async ({ page }) => {
  await page.goto('/');
  const todayNum = String(new Date().getDate());
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await page.getByRole('button', { name: 'begin' }).click();
  await page.getByText('today, in one gesture').waitFor();

  // — historique : cycle en cours visible, correction du jour J1
  await page.getByRole('link', { name: 'history' }).click();
  await page.getByText('current cycle').click();
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'headache' }).click();
  await dialog.getByPlaceholder('a note for this day, if you like').fill('note de test');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  // — persistance après rechargement
  await page.reload();
  await page.getByText('current cycle').click();
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'headache' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(dialog.getByPlaceholder('a note for this day, if you like')).toHaveValue(
    'note de test',
  );
  await page.keyboard.press('Escape');

  // — langue : l'app (anglais par défaut) passe en français puis revient
  await page.getByRole('link', { name: 'settings' }).click();
  await page.getByRole('button', { name: 'français' }).click();
  await expect(page.getByRole('link', { name: "aujourd'hui" })).toBeVisible();
  await page.getByRole('button', { name: 'english' }).click();
  await expect(page.getByRole('link', { name: 'today' })).toBeVisible();

  // — la version du build est affichée dans « à propos »
  await expect(page.getByText(/version \d+\.\d+\.\d+ · [0-9a-f]{7} · \d{4}-\d{2}-\d{2}/)).toBeVisible();
});
