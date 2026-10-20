import { expect, test } from '@playwright/test';

test('cadastra um cartão e recalcula as faturas ao mudar o fechamento', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/configuracoes');
  const cartoes = page.getByRole('region', { name: 'Cartões' });

  await cartoes.getByRole('button', { name: 'Adicionar' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo cartão' });
  await novo.getByLabel('Nome').fill('Cartão Rosa');
  await novo.getByRole('radio', { name: 'Rosa' }).focus();
  await page.keyboard.press('Space');
  await novo.getByLabel('Fecha dia').fill('15');
  await novo.getByLabel('Vence dia').fill('22');
  await page.keyboard.press('Enter');
  await expect(cartoes.getByRole('row', { name: /Cartão Rosa/ })).toContainText('Dia 15');

  await cartoes.getByRole('button', { name: 'Editar Cartão Roxo' }).click();
  await page.getByLabel('Fecha dia').fill('10');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const previa = page.getByRole('dialog', { name: '2 compras mudam de fatura' });
  await expect(previa).toContainText('Supermercado');
  await previa.getByRole('button', { name: 'Salvar e mover 2 compras' }).click();

  await expect(page.getByText('Cartão salvo').last()).toBeVisible();
  await expect(cartoes.getByRole('row', { name: /Cartão Roxo/ })).toContainText('Dia 10');
});

test('no navegador, backup aparece como recurso do app instalado', async ({ page }) => {
  await page.goto('/#/configuracoes');
  await page
    .getByRole('navigation', { name: 'Seções das configurações' })
    .getByRole('button', { name: 'Dados e backup' })
    .click();
  await expect(page.getByRole('region', { name: 'Dados e backup' })).toContainText(
    'Backup e restauração funcionam no app instalado.',
  );
});
