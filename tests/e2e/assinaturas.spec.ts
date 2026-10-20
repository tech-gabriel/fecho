import { expect, test } from '@playwright/test';

test('cria uma assinatura, vê a cobrança na fatura e pausa', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/assinaturas');

  const lista = page.getByRole('region', { name: 'Assinaturas' });
  await expect(lista.getByRole('row', { name: /Nuvem 2 TB/ })).toContainText('Ana paga metade');

  await page.getByRole('button', { name: 'Nova assinatura' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill('Academia');
  await dialog.getByLabel('Valor por mês').fill('99,90');
  await dialog.getByLabel('Cobra dia').fill('25');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  const academia = lista.getByRole('row', { name: /Academia/ });
  await expect(academia).toContainText('25/10');

  await page.getByRole('link', { name: 'Faturas' }).click();
  await page.getByRole('option', { name: /Cartão Roxo/ }).click();
  await expect(page.getByRole('cell', { name: 'Academia' })).toBeVisible();

  await page.getByRole('link', { name: 'Assinaturas' }).click();
  await academia.getByRole('switch').click();
  await expect(academia).toContainText('Pausada');
});
