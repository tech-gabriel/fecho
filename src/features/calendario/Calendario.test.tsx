import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { useApp } from '@/app/store';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';

let repos: Repositorios;
let ids: { roxo: number; ana: number };

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/calendario'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('grid');
  return router;
}

const dia = (rotulo: RegExp) =>
  within(screen.getByRole('grid')).getByRole('button', { name: rotulo });
const painel = () => screen.getByRole('region', { name: /outubro|setembro|novembro/ });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', legendaDaPagina: null });
  repos = criarRepositoriosEmMemoria();
  ids = {
    roxo: await repos.cartoes.criar({
      nome: 'Cartão Roxo',
      diaFechamento: 28,
      diaVencimento: 5,
      limiteCentavos: 0,
      cor: '#8B5CF6',
      ativo: true,
    }),
    ana: await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true }),
  };
  await repos.compras.salvar({
    cartaoId: ids.roxo,
    descricao: 'Jantar',
    categoriaId: null,
    valorTotal: 32_000,
    numParcelas: 1,
    dataCompra: '2026-09-12',
    recorrente: false,
    rateios: [{ terceiroId: ids.ana, percentual: 100 }],
  });
  for (const nome of ['Nuvem 2 TB', 'Música', 'Academia']) {
    await repos.assinaturas.criar({
      nome,
      cartaoId: ids.roxo,
      categoriaId: null,
      valorCentavos: 2_940,
      dia: 28,
      rateios: [],
      ativa: true,
      inicio: '2026-11',
    });
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Calendário', () => {
  it('mostra fechamento, vencimento atrasado e o reembolso que ficou para trás', async () => {
    await abrir();

    expect(dia(/^Hoje, 20 de outubro$/)).toHaveAttribute('tabindex', '0');
    expect(dia(/^28 de outubro, Fecha Roxo$/)).toBeInTheDocument();
    expect(dia(/^5 de outubro, Roxo atrasado, Ana · R\$\s320,00$/)).toBeInTheDocument();
    expect(screen.getByText('Outubro 2026 · fechamentos, vencimentos e cobranças')).toBeVisible();
  });

  it('abre o dia no painel e leva à fatura no mês certo', async () => {
    const router = await abrir();

    fireEvent.click(dia(/^5 de outubro/));

    expect(within(painel()).getByRole('heading', { name: '5 de outubro' })).toBeInTheDocument();
    expect(within(painel()).getByText('Ana ainda deve R$ 320,00')).toBeInTheDocument();
    fireEvent.click(within(painel()).getByRole('link', { name: /Fatura do Cartão Roxo atrasada/ }));

    await screen.findByRole('heading', { level: 1, name: 'Faturas' });
    expect(router.state.location.search).toBe(`?cartao=${String(ids.roxo)}`);
    expect(useApp.getState().competencia).toBe('2026-09');
  });

  it('mostra no máximo 2 eventos por dia e o restante como +N', async () => {
    useApp.setState({ competencia: '2026-11' });
    await abrir();

    const dia28 = dia(/^28 de novembro/);
    expect(dia28).toHaveAccessibleName('28 de novembro, Fecha Roxo, Nuvem 2 TB, Música, Academia');
    expect(within(dia28).getByText('+2')).toBeInTheDocument();
  });

  it('anda pelos dias com as setas, Home e End', async () => {
    await abrir();

    const grade = screen.getByRole('grid');
    fireEvent.keyDown(grade, { key: 'ArrowRight' });
    expect(dia(/^21 de outubro/)).toHaveFocus();
    fireEvent.keyDown(grade, { key: 'ArrowDown' });
    expect(dia(/^28 de outubro/)).toHaveFocus();
    expect(within(painel()).getByText('Fecha o Cartão Roxo')).toBeInTheDocument();
    fireEvent.keyDown(grade, { key: 'Home' });
    expect(dia(/^25 de outubro/)).toHaveFocus();
    fireEvent.keyDown(grade, { key: 'End' });
    expect(dia(/^31 de outubro/)).toHaveFocus();
    fireEvent.keyDown(grade, { key: 'ArrowDown' });
    expect(dia(/^31 de outubro/)).toHaveFocus();
  });

  it('lista os próximos 20 dias e avisa quando o dia está vazio', async () => {
    await abrir();

    const proximos = screen.getByRole('region', { name: 'Próximos 20 dias' });
    expect(
      within(proximos)
        .getAllByRole('listitem')
        .map((l) => l.textContent),
    ).toEqual(['28/10Fecha o Cartão Roxo']);
    expect(within(painel()).getByText('Nada marcado para este dia.')).toBeInTheDocument();
  });

  it('sem nada pela frente, diz que nada vence', async () => {
    repos = criarRepositoriosEmMemoria();
    await abrir();

    expect(screen.getByText('Nada vence nos próximos 20 dias.')).toBeInTheDocument();
  });
});
