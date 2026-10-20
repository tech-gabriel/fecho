import { expect, test } from '@playwright/test';

test('compra dividida aparece na fatura por dono e a fatura é paga e desfeita', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/faturas');
  const lista = page.getByRole('listbox', { name: 'Cartões' });
  await expect(lista.getByRole('option', { name: /Cartão Roxo/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.keyboard.press('Control+n');
  const dialog = page.getByRole('dialog', { name: 'Nova compra' });
  await dialog.getByLabel('Valor').fill('200,00');
  await dialog.getByLabel('Descrição').fill('Fone de ouvido');
  await dialog.getByRole('radio', { name: 'Dividida' }).click();
  await dialog.getByRole('button', { name: 'Carla', pressed: false }).click();
  await dialog.getByLabel('Descrição').press('Enter');
  await expect(dialog).toBeHidden();

  const tabela = page.getByRole('table');
  await expect(tabela.getByRole('row', { name: /Fone de ouvido/ })).toHaveCount(2);
  await page.getByRole('radio', { name: 'Terceiros' }).click();
  await expect(tabela.getByRole('row', { name: /Fone de ouvido/ })).toHaveCount(1);
  await expect(tabela.getByRole('row', { name: /Fone de ouvido/ })).toContainText('Carla');

  await page.getByRole('button', { name: 'Marcar como paga' }).click();
  await expect(page.getByText('Fatura do Cartão Roxo marcada como paga')).toBeVisible();
  await expect(lista.getByRole('option', { name: /Cartão Roxo/ })).toContainText('Paga');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'marcada como paga' })
    .getByRole('button', { name: 'Desfazer' })
    .click();
  await expect(page.getByRole('button', { name: 'Marcar como paga' })).toBeVisible();
});
