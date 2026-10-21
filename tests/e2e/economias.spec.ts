import { expect, test } from '@playwright/test';

test('guarda R$ 300 para a Viagem e bate a meta de Outubro', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 10));
  await page.goto('/#/economias');

  const meta = page.getByRole('region', { name: 'Meta de Outubro' });
  await expect(meta).toContainText(/R\$\s500,00/);
  const viagem = page.getByRole('region', { name: 'Objetivos' }).getByRole('listitem').filter({
    hasText: 'Viagem para o Chile',
  });
  await expect(viagem).toContainText('39%');

  await page.getByRole('button', { name: 'Registrar economia' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar economia' });
  await dialog.getByLabel('Valor').fill('300,00');
  await dialog.getByRole('combobox', { name: 'Objetivo' }).click();
  await page.getByRole('option', { name: 'Viagem para o Chile' }).click();
  await dialog.getByRole('button', { name: 'Salvar' }).click();

  await expect(meta).toContainText('Meta batida!');
  await expect(viagem).toContainText('43%');
});
