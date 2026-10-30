import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { useApp } from '@/app/store';
import { salvarPlanilha } from '@/data/backup';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';

vi.mock('@/data/backup', async (original) => ({
  ...(await original<typeof import('@/data/backup')>()),
  salvarPlanilha: vi.fn((nome: string) => Promise.resolve(nome)),
}));

let repos: Repositorios;

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/relatorio'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Relatório' });
}

const tabela = () => screen.findByRole('table', { name: /Gastos de 2026/ });
const linha = async (nome: string) =>
  within(await tabela()).getByRole('row', { name: new RegExp(nome) });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', legendaDaPagina: null });
  repos = criarRepositoriosEmMemoria();
  const roxo = await repos.cartoes.criar({
    nome: 'Cartão Roxo',
    diaFechamento: 28,
    diaVencimento: 5,
    limiteCentavos: 0,
    cor: '#8B5CF6',
    ativo: true,
  });
  const ana = await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true });
  const mercado = await repos.categorias.criar({
    nome: 'Mercado',
    icone: 'shopping-cart',
    ativo: true,
  });
  const compra = (dataCompra: string, valorTotal: number, dividida = false) =>
    repos.compras.salvar({
      cartaoId: roxo,
      descricao: 'Compra',
      categoriaId: mercado,
      valorTotal,
      numParcelas: 1,
      dataCompra,
      recorrente: false,
      rateios: dividida
        ? [
            { terceiroId: null, percentual: 50 },
            { terceiroId: ana, percentual: 50 },
          ]
        : [],
    });
  await compra('2026-01-10', 10_000);
  await compra('2026-03-10', 40_000, true);
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Relatório do ano', () => {
  it('mostra a minha parte por categoria e mês, com o total do ano', async () => {
    await abrir();

    const mercado = await linha('Mercado');
    expect(mercado).toHaveTextContent(/R\$\s100,00.*R\$\s200,00.*R\$\s300,00/);
    expect(screen.getByText('Total do ano').parentElement).toHaveTextContent(/R\$\s300,00/);
  });

  it('troca para Todos e para Terceiros', async () => {
    await abrir();
    await linha('Mercado');

    fireEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    expect(await linha('Mercado')).toHaveTextContent(/R\$\s500,00$/);

    fireEvent.click(screen.getByRole('radio', { name: 'Terceiros' }));
    expect(await linha('Mercado')).toHaveTextContent(/R\$\s200,00$/);
  });

  it('volta um ano e mostra o vazio', async () => {
    await abrir();
    await linha('Mercado');

    fireEvent.click(screen.getByRole('button', { name: 'Ano anterior' }));

    expect(await screen.findByText('Nada lançado em 2025.')).toBeInTheDocument();
  });

  it('exporta as três visões numa planilha', async () => {
    await abrir();
    await linha('Mercado');

    fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));

    await waitFor(() => {
      expect(salvarPlanilha).toHaveBeenCalledWith(
        'fecho-relatorio-2026.xlsx',
        expect.any(Uint8Array),
      );
    });
    expect(await screen.findByText('Relatório de 2026 exportado')).toBeInTheDocument();
  });
});
