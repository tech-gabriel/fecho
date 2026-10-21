import { expect, test } from '@playwright/test';

test('Ctrl+K navega, acha uma compra, registra depósito e ? abre os atalhos', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  await page.keyboard.press('Control+k');
  const paleta = page.getByRole('dialog', { name: 'Comandos' });
  await page.keyboard.type('faturas');
  await page.keyboard.press('Enter');
  await expect(paleta).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Faturas' })).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(paleta.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('super');
  await expect(paleta.getByRole('group', { name: 'Lançamentos' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Editar compra' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Editar compra' })).toBeHidden();

  await page.keyboard.press('Control+k');
  await expect(paleta.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('depósito');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'A receber' })).toBeVisible();
  const deposito = page.getByLabel(/^Quanto .+ depositou\?$/);
  await expect(deposito).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(deposito).toBeHidden();

  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeVisible();
});
