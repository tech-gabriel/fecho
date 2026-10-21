import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';

test('exporta as compras do mês numa planilha com uma aba por cartão', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/lancamentos');
  await expect(page.getByRole('grid', { name: 'Lançamentos de Outubro 2026' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar .xlsx' }).click();
  const arquivo = await download;

  expect(arquivo.suggestedFilename()).toBe('fecho-2026-10.xlsx');
  const livro = XLSX.read(await readFile(await arquivo.path()), { type: 'buffer' });
  expect(livro.SheetNames.length).toBeGreaterThan(0);
  const [cabecalho] = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[livro.SheetNames[0] ?? ''], {
    header: 1,
  });
  expect(cabecalho).toEqual(['Data', 'Descrição', 'Valor', 'Parcela', 'Responsável', 'Categoria']);
  await expect(page.getByText('Planilha de Outubro exportada')).toBeVisible();
});
