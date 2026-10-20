import path from 'node:path';
import { expect, test } from '@playwright/test';

test('importa um .csv, cria o cartão da aba e as compras aparecem em Lançamentos', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/lancamentos');
  await page.getByRole('link', { name: 'Importar .xlsx' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Traga sua planilha' })).toBeVisible();

  await page
    .getByLabel('Arquivo da planilha')
    .setInputFiles(path.join(import.meta.dirname, 'arquivos', 'compras-nubank.csv'));
  await expect(page.getByText('Arquivo lido')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText('Tudo certo nesta aba')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Fecha dia').fill('28');
  await page.getByLabel('Vence dia').fill('5');
  await page.getByRole('button', { name: 'Criar cartão' }).click();
  await expect(page.getByRole('heading', { name: 'Tudo revisado' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: 'Importar 3 compras' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tudo pronto!' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir o Fechô' }).click();

  const grade = page.getByRole('grid', { name: 'Lançamentos de Outubro 2026' });
  await expect(grade.getByRole('row', { name: /Geladeira/ })).toContainText('1/10');
  await expect(grade.getByRole('row', { name: /Show/ })).toContainText('Bruno');
  await expect(grade.getByRole('row', { name: /Padaria/ })).toContainText('compras-nubank');
});
