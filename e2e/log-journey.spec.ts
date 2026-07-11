import { expect, test } from '@playwright/test';

/** Smoke test du parcours saisie : onboarding → log règles → persistance. */

test('onboarding une question, saisie en un geste, données persistées', async ({ page }) => {
  await page.goto('/');

  // — onboarding : une seule question, date picker custom.
  // On choisit aujourd'hui → J1, phase menstruelle → chips par défaut stables.
  await expect(page.getByText('Quand ont commencé tes dernières règles ?')).toBeVisible();
  const todayNum = String(new Date().getDate());
  await page.getByRole('button', { name: todayNum, exact: true }).click();
  await page.getByRole('button', { name: 'commencer' }).click();

  // — cadran : jour du cycle affiché, phrase contextuelle, prédiction honnête
  await expect(page.getByText("aujourd'hui, en un geste")).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(/Prochaines règles|prédiction/)).toBeVisible();

  // — saisie : chip règles, deux taps → intensité 2, « c'est noté »
  const flowChip = page.getByRole('button', { name: /règles/ });
  await flowChip.click();
  await expect(page.getByText("c'est noté")).toBeVisible();
  await flowChip.click();
  await expect(flowChip).toHaveAttribute('aria-pressed', 'true');

  // — un symptôme
  await page.getByRole('button', { name: 'fatigue' }).click();

  // — feuille de phase au clavier (zone tactile SVG focusable), fermeture backdrop
  await page.locator('svg [role="button"]').first().press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Tes patterns', { exact: true })).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // — persistance : rechargement, tout est encore là (IndexedDB)
  await page.reload();
  const flowAfter = page.getByRole('button', { name: /règles/ });
  await expect(flowAfter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'fatigue' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
