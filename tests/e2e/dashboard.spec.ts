import { expect, test } from '@playwright/test';

test('mostra o caixa do mês, cadastra renda e reage a uma compra nova', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/');
  const caixa = page.getByRole('region', { name: 'Preciso ter em caixa' });
  await expect(caixa).toContainText('em 3 faturas e R$ 570,00 em 2 contas.');

  const renda = page.getByRole('main').getByRole('button', { name: /Renda/ });
  await expect(renda).toContainText('R$ 7.200,00');
  await renda.click();
  const dialog = page.getByRole('dialog', { name: 'Renda de Outubro' });
  await dialog.getByLabel('De onde vem').fill('Bônus');
  await dialog.getByLabel('Valor', { exact: true }).fill('800,00');
  await dialog.getByRole('radio', { name: 'Só neste mês' }).click();
  await dialog.getByRole('button', { name: 'Adicionar' }).click();
  await expect(dialog).toContainText('R$ 8.000,00');
  await page.keyboard.press('Escape');
  await expect(renda).toContainText('R$ 8.000,00');

  await page.keyboard.press('Control+n');
  const nova = page.getByRole('dialog', { name: 'Nova compra' });
  await nova.getByLabel('Valor').fill('100,00');
  await nova.getByLabel('Descrição').fill('Livro');
  await nova.getByLabel('Descrição').press('Enter');
  await expect(nova).toBeHidden();
  await expect(page.getByRole('main').getByRole('link', { name: /Meus gastos/ })).toContainText(
    'da renda',
  );
});
