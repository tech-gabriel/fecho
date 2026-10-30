import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { useApp } from '@/app/store';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';

let repos: Repositorios;
let aluguel: number;

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/contas'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Contas fixas' });
}

const linha = (nome: string) => screen.findByRole('row', { name: new RegExp(nome) });
const preencher = (dialog: HTMLElement, rotulo: string, valor: string) => {
  fireEvent.change(within(dialog).getByLabelText(rotulo), { target: { value: valor } });
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', legendaDaPagina: null });
  repos = criarRepositoriosEmMemoria();
  aluguel = await repos.contasFixas.criar({
    descricao: 'Aluguel',
    categoriaId: null,
    valorCentavos: 180_000,
    dia: 10,
    inicio: '2026-01',
    ativa: true,
    rateios: [],
  });
  await repos.contasFixas.criar({
    descricao: 'Luz',
    categoriaId: null,
    valorCentavos: 15_000,
    dia: 25,
    inicio: '2026-01',
    ativa: true,
    rateios: [],
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Contas fixas', () => {
  it('lista as contas do mês com status e totais', async () => {
    await abrir();

    expect(await linha('Aluguel')).toHaveTextContent('Atrasada');
    expect(await linha('Luz')).toHaveTextContent('Pendente');
    expect(screen.getByText('Falta pagar').parentElement).toHaveTextContent(/R\$\s1\.950,00/);
  });

  it('cadastra uma conta nova', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Nova conta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova conta fixa' });
    preencher(dialog, 'Descrição', 'Plano de saúde');
    preencher(dialog, 'Valor por mês', '420,00');
    preencher(dialog, 'Vence dia', '15');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await linha('Plano de saúde')).toHaveTextContent(/R\$\s420,00/);
    expect((await repos.contasFixas.listar())[2]).toMatchObject({
      descricao: 'Plano de saúde',
      valorCentavos: 42_000,
      dia: 15,
      inicio: '2026-10',
    });
  });

  it('divide a conta com uma pessoa', async () => {
    const ana = await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true });
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Nova conta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova conta fixa' });
    preencher(dialog, 'Descrição', 'Internet');
    preencher(dialog, 'Valor por mês', '120,00');
    preencher(dialog, 'Vence dia', '5');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Dividida' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ana', pressed: false }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await linha('Internet')).toHaveTextContent('Ana paga metade');
    expect(
      (await repos.contasFixas.listar()).find((c) => c.descricao === 'Internet')?.rateios,
    ).toEqual([
      { terceiroId: ana, percentual: 50 },
      { terceiroId: null, percentual: 50 },
    ]);
  });

  it('marca como paga com o valor do mês ajustado e desfaz', async () => {
    await abrir();

    fireEvent.click(within(await linha('Luz')).getByRole('button', { name: 'Marcar paga' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pagar Luz de Outubro' });
    preencher(dialog, 'Valor pago', '187,40');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marcar paga' }));

    await waitFor(async () => {
      expect(await linha('Luz')).toHaveTextContent('Paga');
    });
    expect(await linha('Luz')).toHaveTextContent(/R\$\s187,40/);
    expect(await repos.contasFixas.pagamentos()).toEqual([
      expect.objectContaining({
        competencia: '2026-10',
        valorCentavos: 18_740,
        pagoEm: '2026-10-20',
      }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect(await repos.contasFixas.pagamentos()).toEqual([]);
    });
  });

  it('arquiva a conta e ela some dos meses sem pagamento', async () => {
    await abrir();

    fireEvent.pointerDown(
      within(await linha('Aluguel')).getByRole('button', { name: 'Mais ações de Aluguel' }),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(async () => {
      expect((await repos.contasFixas.listar()).find((c) => c.id === aluguel)?.ativa).toBe(false);
    });
    await waitFor(() => {
      expect(screen.queryByRole('row', { name: /Aluguel/ })).not.toBeInTheDocument();
    });
  });
});
