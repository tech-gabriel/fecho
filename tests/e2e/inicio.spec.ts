import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`abre o shell e navega no tema ${colorScheme === 'light' ? 'claro' : 'escuro'}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Faturas' })
      .click();
    await expect(page).toHaveURL(/#\/faturas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Faturas' })).toBeVisible();

    await page.keyboard.press('Control+b');
    await expect(page.getByText('Fechô', { exact: true })).toBeHidden();
    await page.reload();
    await expect(page.getByText('Fechô', { exact: true })).toBeHidden();
  });
}
