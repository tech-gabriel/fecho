import path from 'node:path';
import { expect, test } from '@playwright/test';

test('confere o Roxo com o extrato, fecha Outubro e trava a fatura', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10));
  await page.goto('/#/fechar/2026-10');

  await page
    .getByLabel('Escolher arquivo')
    .setInputFiles(path.join(import.meta.dirname, 'arquivos', 'fatura-roxo-outubro.csv'));
  await expect(page.getByText(/Bateu! O Fechô e o extrato/)).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como conferida' }).click();
  await expect(page.getByText(/conferida em 03\/11 com fatura-roxo-outubro\.csv/)).toBeVisible();

  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Enter');
  await page.getByRole('button', { name: /Fechar Outubro/ }).click();
  await expect(page.getByRole('heading', { name: 'Outubro fechado' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Mês de referência' })).toContainText('Mês fechado');

  await page.getByRole('link', { name: 'Faturas' }).click();
  await page.getByRole('option', { name: /Cartão Roxo/ }).click();
  await page.getByRole('button', { name: 'Marcar como paga' }).click();
  await expect(page.getByText('Outubro está fechado. Reabra o mês para mudar.')).toBeVisible();
});
