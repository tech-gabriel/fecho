import { expect, test } from '@playwright/test';

test('cobra a Ana, registra um depósito parcial e desfaz', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/faturas');

  await page
    .getByRole('status')
    .filter({ hasText: 'de Ana' })
    .getByRole('link', { name: 'Ver em A receber' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'A receber' })).toBeVisible();
  const ana = page.getByRole('listbox', { name: 'Pessoas' }).getByRole('option', { name: /Ana/ });
  await expect(ana).toHaveAttribute('aria-selected', 'true');
  await expect(ana).toContainText(/R\$\s320,00/);

  await page.getByRole('button', { name: 'Copiar cobrança' }).click();
  await expect(page.getByRole('button', { name: 'Copiado' })).toBeVisible();
  expect(await page.evaluate('navigator.clipboard.readText()')).toContain('Oi, Ana!');
  await expect(page.getByText(/^Cobrança copiada ·/)).toBeVisible();

  await page.getByRole('button', { name: 'Outro valor' }).click();
  await page.getByLabel('Quanto Ana depositou?').fill('50,00');
  await expect(page.getByText(/status vira Parcial/)).toBeVisible();
  await page.getByRole('button', { name: 'Registrar depósito' }).click();
  await expect(ana).toContainText(/R\$\s270,00/);

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Depósito de R$' })
    .getByRole('button', { name: 'Desfazer' })
    .click();
  await expect(ana).toContainText(/R\$\s320,00/);
});
