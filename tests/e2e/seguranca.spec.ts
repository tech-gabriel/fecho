import { expect, test } from '@playwright/test';

test('define o PIN, bloqueia com Ctrl+L e desbloqueia', async ({ page }) => {
  await page.goto('/#/configuracoes?secao=seguranca');

  await page.getByRole('switch', { name: 'Pedir PIN' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Defina um PIN' });
  await dialogo.getByLabel('PIN', { exact: true }).fill('2580');
  await dialogo.getByLabel('Repita o PIN').fill('2580');
  await dialogo.getByRole('button', { name: 'Ligar PIN' }).click();
  await expect(page.getByRole('switch', { name: 'Pedir PIN' })).toBeChecked();

  await page.keyboard.press('Control+l');
  const bloqueio = page.getByRole('dialog', { name: 'O Fechô está bloqueado' });
  await expect(bloqueio).toBeVisible();

  await bloqueio.getByLabel('PIN').fill('1111');
  await expect(bloqueio.getByText('PIN errado. Você ainda tem 4 tentativas.')).toBeVisible();
  await bloqueio.getByLabel('PIN').fill('2580');

  await expect(bloqueio).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
});
