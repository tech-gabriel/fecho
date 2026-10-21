import { expect, test } from '@playwright/test';

test('marca a parcela do empréstimo e empresta para a Ana', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 12, 10));
  await page.goto('/#/emprestimos');

  const pessoal = page.getByRole('region', { name: 'Empréstimo pessoal' });
  await expect(pessoal).toContainText('7ª venceu 10/11');
  await pessoal.getByRole('button', { name: 'Marcar a parcela 7 como paga' }).click();
  await expect(pessoal.getByText('Ainda falta pagar').locator('..')).toContainText(
    /R\$\s2\.400,00/,
  );

  await page.getByRole('button', { name: 'Novo empréstimo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo empréstimo' });
  await dialog.getByRole('radio', { name: 'Emprestei' }).click();
  await dialog.getByRole('combobox', { name: 'Para quem' }).click();
  await page.getByRole('option', { name: 'Ana' }).click();
  await dialog.getByLabel('Valor').fill('250,00');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('region', { name: 'Você emprestou' })).toContainText(
    /Ana · R\$\s250,00/,
  );

  await page.getByRole('link', { name: 'A receber' }).first().click();
  await page.getByRole('option', { name: /Ana/ }).click();
  await expect(page.getByRole('cell', { name: 'Devolve até 12/11' })).toBeVisible();
});
