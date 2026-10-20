import { expect, test } from '@playwright/test';

test('mostra os alertas no sino e abre a fatura atrasada', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 2, 10));
  await page.goto('/#/');

  await page.getByRole('button', { name: /^Alertas, \d+ novos$/ }).click();
  const central = page.getByRole('dialog');
  await expect(
    central.getByText(/Faltam R\$\s\d.* de Ana para fechar a fatura do Cartão Roxo/),
  ).toBeVisible();
  await expect(central.getByText(/O Cartão Azul fecha amanhã/)).toBeVisible();

  await central.getByRole('button', { name: /Cartão Verde-água está atrasada/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Faturas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cartão Verde-água' })).toBeVisible();

  await page.getByRole('button', { name: /^Alertas/ }).click();
  await page.getByRole('button', { name: 'Marcar tudo como lido' }).click();
  await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toBeVisible();
});
