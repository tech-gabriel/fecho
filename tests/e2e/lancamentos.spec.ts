import { expect, test } from '@playwright/test';

test('busca, renomeia, muda categoria em massa, exclui e edita uma compra', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/lancamentos');
  const grade = page.getByRole('grid', { name: 'Lançamentos de Outubro 2026' });
  await expect(grade).toBeVisible();

  await page.keyboard.press('Control+f');
  await expect(page.getByRole('searchbox', { name: 'Filtrar por descrição' })).toBeFocused();
  await page.keyboard.type('super');
  await expect(grade.getByRole('row')).toHaveCount(2);

  const linha = grade.getByRole('row', { name: /Supermercado/ });
  await linha.focus();
  await page.keyboard.press('F2');
  await grade.getByRole('textbox', { name: 'Descrição' }).fill('Supermercado Extra');
  await page.keyboard.press('Enter');
  await expect(grade.getByRole('row', { name: /Supermercado Extra/ })).toBeVisible();

  await page.getByRole('button', { name: /Limpar a busca/ }).click();
  await grade
    .getByRole('row', { name: /Supermercado Extra/ })
    .getByRole('checkbox')
    .click();
  await grade
    .getByRole('row', { name: /Streaming/ })
    .getByRole('checkbox')
    .click();
  const barra = page.getByRole('toolbar', { name: 'Ações da seleção' });
  await expect(barra).toContainText('2 selecionados');
  await barra.getByRole('button', { name: /Mudar categoria/ }).click();
  await page.getByRole('button', { name: 'Compras' }).click();
  await expect(grade.getByRole('row', { name: /Streaming/ })).toContainText('Compras');

  await grade
    .getByRole('row', { name: /Streaming/ })
    .getByRole('checkbox')
    .click();
  await page.keyboard.press('Delete');
  await expect(grade.getByRole('row', { name: /Streaming/ })).toHaveCount(0);

  await grade.getByRole('row', { name: /Supermercado Extra/ }).focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Editar compra' });
  await expect(sheet.getByLabel('Valor')).toHaveValue('487,30');
  await sheet.getByRole('button', { name: '2×', exact: true }).click();
  await sheet.getByRole('button', { name: /Salvar/ }).click();
  await expect(sheet).toBeHidden();
  await expect(grade.getByRole('row', { name: /Supermercado Extra/ })).toContainText('1/2');
});
