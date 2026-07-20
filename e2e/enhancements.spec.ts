import { expect, test } from '@playwright/test';

/**
 * Nouveaux repères : « pourquoi cette fenêtre ? » explique la prédiction, et
 * les notes deviennent cherchables dans l'historique.
 */

test('why-sheet de la prédiction + recherche dans les notes', async ({ page }) => {
  await page.goto('/');
  const todayNum = String(new Date().getDate());
  // onboarding : dernières règles = aujourd'hui
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await page.getByRole('button', { name: 'begin' }).click();
  await page.getByText('today, in one gesture').waitFor();

  // — la prédiction s'explique dans une feuille dédiée
  await page.getByRole('button', { name: 'why this window?' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('next period')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  // — une note posée sur aujourd'hui devient cherchable dans l'historique
  await page.getByRole('link', { name: 'history' }).click();
  await page.getByText('current cycle').click();
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('a note for this day, if you like').fill('flower market');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  const search = page.getByPlaceholder('search your notes');
  await expect(search).toBeVisible();
  await search.fill('flower');
  await expect(page.getByText('flower market')).toBeVisible();
  await search.fill('zzz');
  await expect(page.getByText('no note matches')).toBeVisible();
});
