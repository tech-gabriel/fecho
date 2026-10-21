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

test('bloqueia com um diálogo aberto, ignora atalhos e desbloqueia pelo teclado', async ({
  page,
}) => {
  await page.goto('/#/configuracoes?secao=seguranca');
  await page.getByRole('switch', { name: 'Pedir PIN' }).click();
  const d = page.getByRole('dialog', { name: 'Defina um PIN' });
  await d.getByLabel('PIN', { exact: true }).fill('2580');
  await d.getByLabel('Repita o PIN').fill('2580');
  await d.getByRole('button', { name: 'Ligar PIN' }).click();
  await expect(d).toBeHidden();
  await page.keyboard.press('Control+n');
  await expect(page.getByRole('dialog', { name: 'Nova compra' })).toBeVisible();
  await page.keyboard.press('Control+l');
  const bloqueio = page.getByRole('dialog', { name: 'O Fechô está bloqueado' });
  await expect(bloqueio.getByLabel('PIN')).toBeFocused();
  await expect(bloqueio.getByRole('heading', { name: 'O Fechô está bloqueado' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Comandos' })).toHaveCount(0);
  await page.keyboard.type('2580');
  await expect(bloqueio).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
});
