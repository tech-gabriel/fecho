import { expect, test } from '@playwright/test';

test('registra uma compra dividida em 6× e desfaz', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  await page.keyboard.press('Control+n');
  const dialog = page.getByRole('dialog', { name: 'Nova compra' });
  await expect(dialog.getByLabel('Valor')).toBeFocused();
  await page.keyboard.type('1.299,00');
  await dialog.getByLabel('Descrição').fill('Cadeira de escritório');
  await dialog.getByRole('radio', { name: 'Dividida' }).click();
  await dialog.getByRole('button', { name: 'Ana', pressed: false }).click();
  await dialog.getByRole('button', { name: '6×' }).click();

  const previa = dialog.getByRole('list', { name: 'Prévia das parcelas' });
  await expect(previa).toContainText('1/6');
  await expect(previa).toContainText('Ana R$ 108,25');

  await dialog.getByLabel('Descrição').press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Compra registrada')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
});
