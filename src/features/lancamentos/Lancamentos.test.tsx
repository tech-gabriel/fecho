import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { useApp } from '@/app/store';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { DadosNovaCompra } from '@/domain/compras';
import type { Repositorios } from '@/data';

let repos: Repositorios;
let ids: { roxo: number; azul: number; ana: number; mercado: number; casa: number };
let compras: { supermercado: number; tenis: number; jantar: number; notebook: number };

async function abrir(caminho = '/lancamentos') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Lançamentos' });
  return router;
}

const grade = () => screen.getByRole('grid', { name: 'Lançamentos de Outubro 2026' });
const linhas = () => within(grade()).getAllByRole('row').slice(1);
const linha = (nome: RegExp) => within(grade()).getByRole('row', { name: nome });
const rodape = () => screen.getByText(/lançamentos?( de \d+)?$/).parentElement;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  localStorage.clear();
  useApp.setState({
    competencia: '2026-10',
    novaCompraAberta: false,
    novaCompraPreenchida: null,
    compraEmEdicao: null,
    legendaDaPagina: null,
  });
  repos = criarRepositoriosEmMemoria();
  const cartao = (nome: string, diaFechamento: number, cor: string) =>
    repos.cartoes.criar({
      nome,
      diaFechamento,
      diaVencimento: 5,
      limiteCentavos: 0,
      cor,
      ativo: true,
    });
  ids = {
    roxo: await cartao('Cartão Roxo', 28, '#8B5CF6'),
    azul: await cartao('Cartão Azul', 3, '#3B82F6'),
    ana: await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true }),
    mercado: await repos.categorias.criar({ nome: 'Mercado', icone: 'shopping-cart', ativo: true }),
    casa: await repos.categorias.criar({ nome: 'Casa', icone: 'house', ativo: true }),
  };
  const compra = (dados: Partial<DadosNovaCompra>) =>
    repos.compras.salvar({
      cartaoId: ids.roxo,
      descricao: 'Compra',
      categoriaId: null,
      valorTotal: 1_000,
      numParcelas: 1,
      dataCompra: '2026-10-12',
      recorrente: false,
      rateios: [],
      ...dados,
    });
  compras = {
    supermercado: await compra({
      descricao: 'Supermercado',
      categoriaId: ids.mercado,
      valorTotal: 48_730,
    }),
    tenis: await compra({
      descricao: 'Tênis',
      valorTotal: 129_900,
      numParcelas: 6,
      dataCompra: '2026-10-02',
      rateios: [
        { terceiroId: null, percentual: 50 },
        { terceiroId: ids.ana, percentual: 50 },
      ],
    }),
    jantar: await compra({
      descricao: 'Jantar',
      valorTotal: 32_000,
      dataCompra: '2026-10-18',
      rateios: [{ terceiroId: ids.ana, percentual: 100 }],
    }),
    notebook: await compra({
      cartaoId: ids.azul,
      descricao: 'Notebook',
      valorTotal: 480_000,
      numParcelas: 10,
      dataCompra: '2026-06-15',
    }),
  };
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Lançamentos', () => {
  it('lista uma linha por dono, da compra mais recente, com os totais', async () => {
    await abrir();

    await screen.findByRole('grid');
    expect(linhas().map((l) => within(l).getAllByRole('cell')[2]?.textContent)).toEqual([
      'Jantar',
      'Supermercado',
      'Tênis1/6',
      'Tênis1/6',
      'Notebook4/10',
    ]);
    expect(rodape()).toHaveTextContent('5 lançamentos');
    expect(rodape()).toHaveTextContent('Meu R$ 1.075,55');
    expect(rodape()).toHaveTextContent('Terceiros R$ 428,25');
    expect(rodape()).toHaveTextContent('Total R$ 1.503,80');
    expect(
      screen.getByText('Outubro 2026 · duplo clique edita, botão direito abre mais ações'),
    ).toBeInTheDocument();
  });

  it('busca pela descrição, filtra por dono e limpa', async () => {
    const router = await abrir();
    await screen.findByRole('grid');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar por descrição' }), {
      target: { value: 'tên' },
    });
    expect(linhas()).toHaveLength(2);
    expect(rodape()).toHaveTextContent('2 lançamentos de 5');
    expect(router.state.location.search).toBe('?q=t%C3%AAn');

    fireEvent.click(screen.getByRole('radio', { name: 'Terceiros' }));
    expect(linhas()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar a busca por “tên”' }));
    expect(linhas()).toHaveLength(2);
  });

  it('mostra o vazio do filtro e limpa tudo', async () => {
    await abrir('/lancamentos?q=xyz');

    expect(await screen.findByText('Nada encontrado com esse filtro.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });

  it('ordena pelo valor e esconde colunas', async () => {
    await abrir();
    await screen.findByRole('grid');

    fireEvent.click(within(grade()).getByRole('button', { name: 'Valor' }));
    expect(within(grade()).getByRole('columnheader', { name: /Valor/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(linhas()[0]).toHaveTextContent('Supermercado');

    fireEvent.click(screen.getByRole('button', { name: 'Colunas' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Cartão' }));
    expect(within(grade()).queryByRole('columnheader', { name: 'Cartão' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('fecho:colunas-lancamentos') ?? '{}')).toMatchObject({
      cartao: false,
    });
  });

  it('F2 edita a descrição na linha', async () => {
    await abrir();
    await screen.findByRole('grid');

    const primeira = linha(/Jantar/);
    primeira.focus();
    fireEvent.keyDown(primeira, { key: 'F2' });
    const campo = await within(grade()).findByRole('textbox', { name: 'Descrição' });
    fireEvent.change(campo, { target: { value: 'Jantar de aniversário' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByText('Descrição atualizada')).toBeInTheDocument();
    expect((await repos.compras.buscar(compras.jantar)).descricao).toBe('Jantar de aniversário');
    expect(
      await within(grade()).findByRole('row', { name: /Jantar de aniversário/ }),
    ).toBeInTheDocument();
  });

  it('seleciona e muda a categoria em massa, com Desfazer', async () => {
    await abrir();
    await screen.findByRole('grid');

    fireEvent.click(within(linha(/Jantar/)).getByRole('checkbox'));
    fireEvent.click(within(linha(/Supermercado/)).getByRole('checkbox'));
    const barra = screen.getByRole('toolbar', { name: 'Ações da seleção' });
    expect(barra).toHaveTextContent('2 selecionados');
    fireEvent.click(within(barra).getByRole('button', { name: /Mudar categoria/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Casa' }));

    expect(await screen.findByText('Categoria alterada em 2 compras')).toBeInTheDocument();
    expect((await repos.compras.buscar(compras.supermercado)).categoriaId).toBe(ids.casa);
    expect(screen.queryByRole('toolbar', { name: 'Ações da seleção' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect((await repos.compras.buscar(compras.supermercado)).categoriaId).toBe(ids.mercado);
    });
  });

  it('Shift+clique seleciona o intervalo e Del exclui as compras', async () => {
    await abrir();
    await screen.findByRole('grid');

    fireEvent.click(within(linha(/Jantar/)).getByRole('checkbox'));
    fireEvent.click(within(linhas()[2] as HTMLElement).getByRole('checkbox'), { shiftKey: true });
    expect(screen.getByRole('toolbar', { name: 'Ações da seleção' })).toHaveTextContent(
      '3 selecionados',
    );

    fireEvent.keyDown(linha(/Jantar/), { key: 'Delete' });

    expect(await screen.findByText('3 compras excluídas')).toBeInTheDocument();
    await waitFor(() => {
      expect(linhas()).toHaveLength(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(linhas()).toHaveLength(5);
    });
  });

  it('Del exclui a linha marcada, não a linha ativa', async () => {
    await abrir();
    await screen.findByRole('grid');

    const caixa = within(linha(/Notebook/)).getByRole('checkbox');
    fireEvent.click(caixa);
    fireEvent.keyDown(caixa, { key: 'Delete' });

    expect(await screen.findByText('Compra excluída')).toBeInTheDocument();
    await expect(repos.compras.buscar(compras.notebook)).rejects.toThrow();
    expect(await repos.compras.buscar(compras.jantar)).toMatchObject({ descricao: 'Jantar' });
  });

  it('marca a compra como de outra pessoa pelo menu de contexto', async () => {
    await abrir();
    await screen.findByRole('grid');

    fireEvent.contextMenu(linha(/Supermercado/));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marcar como de…' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ana' }));

    expect(await screen.findByText('1 compra marcada como de Ana')).toBeInTheDocument();
    expect((await repos.compras.buscar(compras.supermercado)).rateios).toEqual([
      { terceiroId: ids.ana, percentual: 100 },
    ]);
  });

  it('Ctrl+D duplica e Enter abre a edição', async () => {
    await abrir();
    await screen.findByRole('grid');

    const jantar = linha(/Jantar/);
    jantar.focus();
    fireEvent.keyDown(jantar, { key: 'd', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Nova compra' });
    expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Jantar');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const supermercado = linha(/Supermercado/);
    act(() => {
      supermercado.focus();
    });
    fireEvent.keyDown(supermercado, { key: 'Enter' });
    const sheet = await screen.findByRole('dialog', { name: 'Editar compra' });
    expect(await within(sheet).findByText('Supermercado')).toBeInTheDocument();
  });

  it('mês sem compras oferece registrar uma', async () => {
    useApp.setState({ competencia: '2027-06' });
    await abrir();

    expect(await screen.findByText('Nada lançado em Junho ainda.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));
    expect(await screen.findByRole('dialog', { name: 'Nova compra' })).toBeInTheDocument();
  });
});
