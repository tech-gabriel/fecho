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

async function abrir(caminho = '/') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const paleta = () => screen.findByRole('dialog', { name: 'Comandos' });
const busca = async () => within(await paleta()).getByRole('combobox');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', overlay: null, compraEmEdicao: null });
  repos = criarRepositoriosEmMemoria();
  const cartaoId = await repos.cartoes.criar({
    nome: 'Cartão Roxo',
    diaFechamento: 28,
    diaVencimento: 5,
    limiteCentavos: 0,
    cor: '#8B5CF6',
    ativo: true,
  });
  await repos.compras.salvar({
    cartaoId,
    descricao: 'Jantar de aniversário',
    categoriaId: null,
    valorTotal: 8_990,
    numParcelas: 1,
    dataCompra: '2026-07-12',
    recorrente: false,
    rateios: [],
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Command palette', () => {
  it('abre com Ctrl+K, filtra ações e telas e navega', async () => {
    const router = await abrir();

    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    const dialogo = await paleta();
    expect(within(dialogo).getByRole('option', { name: /Fechar Outubro/ })).toBeInTheDocument();
    expect(within(dialogo).getByText('↑↓ navegar · Enter abrir · Esc fechar')).toBeInTheDocument();

    fireEvent.change(await busca(), { target: { value: 'fatu' } });
    const opcoes = within(dialogo).getAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).toEqual([expect.stringMatching(/^FaturasCtrl 2$/)]);

    fireEvent.click(opcoes[0] as HTMLElement);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/faturas');
    });
    expect(screen.queryByRole('dialog', { name: 'Comandos' })).not.toBeInTheDocument();
  });

  it('acha uma compra de outro mês e abre a edição', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));

    fireEvent.change(await busca(), { target: { value: 'aniversario' } });
    const compra = await within(await paleta()).findByRole('option', {
      name: /Jantar de aniversário.*12\/07\/2026.*89,90/,
    });
    fireEvent.click(compra);

    await waitFor(() => {
      expect(useApp.getState().compraEmEdicao).not.toBeNull();
    });
  });

  it('diz quando não acha nada', async () => {
    await abrir();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });

    fireEvent.change(await busca(), { target: { value: 'xyzw' } });

    expect(await screen.findByText('Nada encontrado para “xyzw”')).toBeInTheDocument();
  });

  it('Ver atalhos troca a palette pela folha de atalhos', async () => {
    await abrir();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });

    fireEvent.click(within(await paleta()).getByRole('option', { name: /Ver atalhos/ }));

    expect(await screen.findByRole('dialog', { name: 'Atalhos de teclado' })).toBeInTheDocument();
  });
});

describe('Folha de atalhos', () => {
  it('abre com ? e mostra os grupos', async () => {
    await abrir();

    fireEvent.keyDown(document.body, { key: '?', shiftKey: true });

    const folha = await screen.findByRole('dialog', { name: 'Atalhos de teclado' });
    expect(
      within(folha)
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual(['Geral', 'Navegação', 'Tabelas', 'Formulários', 'Fechar o mês', 'A receber']);
    expect(within(folha).getByText('Copiar a cobrança').nextElementSibling).toHaveTextContent(
      'CtrlShiftC',
    );
  });

  it('não abre quando ? é digitado num campo', async () => {
    await abrir('/lancamentos');
    const campo = await screen.findByRole('searchbox', { name: 'Filtrar por descrição' });

    fireEvent.keyDown(campo, { key: '?', shiftKey: true });

    expect(screen.queryByRole('dialog', { name: 'Atalhos de teclado' })).not.toBeInTheDocument();
  });

  it('abre por Configurações › Atalhos', async () => {
    await abrir('/configuracoes');

    fireEvent.click(
      within(await screen.findByRole('region', { name: 'Atalhos' })).getByRole('button', {
        name: 'Ver atalhos',
      }),
    );

    expect(await screen.findByRole('dialog', { name: 'Atalhos de teclado' })).toBeInTheDocument();
  });
});
