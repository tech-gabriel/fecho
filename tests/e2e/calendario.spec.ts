import { expect, test } from '@playwright/test';

test('abre o dia de fechamento do Roxo e segue para a fatura', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/calendario');

  const grade = page.getByRole('grid');
  await grade.getByRole('button', { name: /^28 de outubro, Fecha Roxo/ }).click();

  const dia = page.getByRole('region', { name: '28 de outubro' });
  await expect(
    dia.getByText(/Compras a partir de 28\/10 entram na fatura de Novembro/),
  ).toBeVisible();
  await dia.getByRole('link', { name: /Fecha o Cartão Roxo/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Faturas' })).toBeVisible();
  await expect(page.getByRole('option', { name: /Cartão Roxo/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
