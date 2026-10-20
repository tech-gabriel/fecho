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
let ids: { roxo: number; azul: number; ana: number; bruno: number; mercado: number; casa: number };

async function abrirApp() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
  return router;
}

async function abrirDialog() {
  fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
  return screen.findByRole('dialog', { name: 'Nova compra' });
}

const digitar = (rotulo: string | RegExp, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
};

const enter = (alvo: Element, shiftKey = false) => {
  fireEvent.keyDown(alvo, { key: 'Enter', shiftKey });
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  localStorage.clear();
  useApp.setState({ novaCompraAberta: false });
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
    bruno: await repos.terceiros.criar({ nome: 'Bruno', cor: '#2563EB', ativo: true }),
    mercado: await repos.categorias.criar({ nome: 'Mercado', icone: 'shopping-cart', ativo: true }),
    casa: await repos.categorias.criar({ nome: 'Casa', icone: 'house', ativo: true }),
  };
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Nova compra', () => {
  it('abre pelo botão do cabeçalho e pelo Ctrl+N, com o foco no valor', async () => {
    await abrirApp();

    fireEvent.click(screen.getByRole('button', { name: /Nova compra/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova compra' });
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Valor')).toHaveFocus();
    });
    expect(within(dialog).getByRole('combobox', { name: 'Cartão' })).toHaveTextContent(
      'Cartão Roxo',
    );
    expect(within(dialog).getByRole('button', { name: /Data/ })).toHaveTextContent('20/10/2026');
    expect(within(dialog).getByText('hoje')).toBeInTheDocument();
  });

  it('mostra os erros no campo e não salva', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));

    expect(await within(dialog).findByText('Digite um valor maior que zero')).toBeInTheDocument();
    expect(within(dialog).getByText('Digite uma descrição')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Valor')).toHaveAttribute('aria-invalid', 'true');
    expect(await repos.compras.parcelasDaCompetencia('2026-10')).toEqual([]);
  });

  it('salva à vista com Enter, sugere a categoria e fecha com toast', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '48,73');
    digitar('Descrição', 'Supermercado Dia');
    expect(within(dialog).getByRole('combobox', { name: 'Categoria' })).toHaveTextContent(
      'Mercadosugerida',
    );
    expect(within(dialog).getByText(/a 1ª entra na fatura de Outubro/)).toHaveTextContent(
      'À vista · a 1ª entra na fatura de Outubro porque o Cartão Roxo fecha no dia 28',
    );
    enter(within(dialog).getByLabelText('Descrição'));

    expect(await screen.findByText('Compra registrada')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await repos.compras.parcelasDaCompetencia('2026-10')).toMatchObject([
      {
        descricao: 'Supermercado Dia',
        valorCentavos: 4_873,
        categoriaId: ids.mercado,
        rateios: [],
      },
    ]);
    expect(localStorage.getItem('fecho:ultimo-cartao')).toBe(String(ids.roxo));
  });

  it('sugere pela última compra parecida', async () => {
    await repos.compras.salvar({
      cartaoId: ids.roxo,
      descricao: 'Uber para casa',
      categoriaId: ids.casa,
      valorTotal: 1_000,
      numParcelas: 1,
      dataCompra: '2026-10-01',
      recorrente: false,
      rateios: [],
    });
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Descrição', 'uber centro');

    expect(within(dialog).getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Casa');
  });

  it('divide com percentuais livres e mostra a parte de cada pessoa na prévia', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '1.299,00');
    digitar('Descrição', 'Cadeira');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Dividida' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ana', pressed: false }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bruno', pressed: false }));
    expect(within(dialog).getByLabelText('Percentual de Ana')).toHaveValue('33');
    expect(within(dialog).getByText('Você: 34%')).toBeInTheDocument();
    digitar('Percentual de Ana', '50');
    fireEvent.click(within(dialog).getByRole('button', { name: '6×' }));

    const previa = within(dialog).getByRole('list', { name: 'Prévia das parcelas' });
    expect(previa).toHaveTextContent('1/6');
    expect(previa).toHaveTextContent('Fatura de Outubro');
    expect(previa).toHaveTextContent('vence 05/11/2026');
    expect(previa).toHaveTextContent('Ana R$ 108,25');
    expect(previa).toHaveTextContent('6/6');
    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));

    await screen.findByText('Compra registrada');
    const [parcela] = await repos.compras.parcelasDaCompetencia('2026-10');
    expect(parcela?.rateios).toEqual([
      { terceiroId: ids.ana, percentual: 50 },
      { terceiroId: ids.bruno, percentual: 33 },
      { terceiroId: null, percentual: 17 },
    ]);
  });

  it('recusa soma acima de 100% e parcelas acima de 24', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '100');
    digitar('Descrição', 'Show');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Dividida' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ana', pressed: false }));
    digitar('Percentual de Ana', '120');
    digitar('Outro número de parcelas', '30');
    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));

    expect(await within(dialog).findByText('Use um percentual de 1 a 100')).toBeInTheDocument();
    expect(within(dialog).getByText('O máximo é 24 parcelas')).toBeInTheDocument();
  });

  it('de outra pessoa grava 100% dela', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '50');
    digitar('Descrição', 'Presente');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'De outra pessoa' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bruno', pressed: false }));
    expect(
      within(dialog).getByText('Bruno deposita o valor todo antes do vencimento'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));

    await screen.findByText('Compra registrada');
    expect((await repos.compras.parcelasDaCompetencia('2026-10'))[0]?.rateios).toEqual([
      { terceiroId: ids.bruno, percentual: 100 },
    ]);
  });

  it('Shift+Enter salva e abre outra, mantendo cartão e data', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '10');
    digitar('Descrição', 'Café');
    enter(within(dialog).getByLabelText('Valor'), true);

    await screen.findByText('Compra registrada');
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Valor')).toHaveValue('');
    });
    expect(within(dialog).getByLabelText('Descrição')).toHaveValue('');
    expect(within(dialog).getByRole('combobox', { name: 'Cartão' })).toHaveTextContent(
      'Cartão Roxo',
    );
    expect(screen.getByRole('dialog', { name: 'Nova compra' })).toBeInTheDocument();
  });

  it('desfaz a compra pelo toast', async () => {
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '10');
    digitar('Descrição', 'Café');
    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));

    await waitFor(async () => {
      expect(await repos.compras.parcelasDaCompetencia('2026-10')).toEqual([]);
    });
  });

  it('grava repetir todo mês e a observação pelas mais opções (Alt+M)', async () => {
    const salvar = vi.spyOn(repos.compras, 'salvar');
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '39,90');
    digitar('Descrição', 'Streaming');
    fireEvent.keyDown(within(dialog).getByLabelText('Valor'), { key: 'm', altKey: true });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Repetir todo mês' }));
    digitar('Observação', 'plano família');
    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));

    await screen.findByText('Compra registrada');
    expect(salvar).toHaveBeenCalledWith(
      expect.objectContaining({ recorrente: true, observacao: 'plano família' }),
    );
  });

  it('sem cartão ativo, leva ao cadastro', async () => {
    await repos.cartoes.atualizar(ids.roxo, { ativo: false });
    await repos.cartoes.atualizar(ids.azul, { ativo: false });
    const router = await abrirApp();
    const dialog = await abrirDialog();

    expect(
      within(dialog).getByText('Cadastre um cartão para registrar compras.'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar cartão' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/configuracoes');
    });
  });
});
