import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`abre o app no tema ${colorScheme === 'light' ? 'claro' : 'escuro'}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Fechô' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
  });
}
