import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  useApp.setState({ novaCompraAberta: false, novaCompraPreenchida: null, compraEmEdicao: null });
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

  it('repetir todo mês (Alt+M) cria a assinatura ligada à compra deste mês', async () => {
    const salvar = vi.spyOn(repos.compras, 'salvar');
    await abrirApp();
    const dialog = await abrirDialog();

    digitar('Valor', '39,90');
    digitar('Descrição', 'Streaming');
    fireEvent.keyDown(within(dialog).getByLabelText('Valor'), { key: 'm', altKey: true });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Repetir todo mês' }));
    digitar('Observação', 'plano família');
    fireEvent.click(within(dialog).getByRole('button', { name: /Salvar/ }));

    await screen.findByText('Compra registrada. A cobrança entra sozinha todo mês.');
    const [assinatura] = await repos.assinaturas.listar();
    expect(assinatura).toMatchObject({
      nome: 'Streaming',
      valorCentavos: 3_990,
      dia: 20,
      ativa: true,
      inicio: '2026-10',
    });
    expect(salvar).toHaveBeenCalledWith(
      expect.objectContaining({
        recorrente: true,
        observacao: 'plano família',
        assinatura: { id: assinatura?.id, mes: '2026-10' },
      }),
    );
    expect(await repos.assinaturas.geradas()).toEqual([`${String(assinatura?.id)}:2026-10`]);
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

  it('Duplicar abre preenchida com a data de hoje', async () => {
    await abrirApp();

    act(() => {
      useApp.getState().abrirNovaCompra({
        cartaoId: ids.azul,
        descricao: 'Mercado do mês',
        categoriaId: ids.mercado,
        valorTotal: 48_730,
        numParcelas: 2,
        dataCompra: '2026-09-01',
        recorrente: false,
        rateios: [{ terceiroId: ids.ana, percentual: 100 }],
      });
    });
    const dialog = await screen.findByRole('dialog', { name: 'Nova compra' });

    expect(within(dialog).getByLabelText('Valor')).toHaveValue('487,30');
    expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Mercado do mês');
    expect(within(dialog).getByRole('combobox', { name: 'Cartão' })).toHaveTextContent(
      'Cartão Azul',
    );
    expect(within(dialog).getByRole('button', { name: /Data/ })).toHaveTextContent('20/10/2026');
    expect(within(dialog).getByRole('radio', { name: 'De outra pessoa' })).toHaveAttribute(
      'data-state',
      'on',
    );
    expect(within(dialog).getByRole('combobox', { name: 'Categoria' })).not.toHaveTextContent(
      'sugerida',
    );
  });
});

describe('Editar compra', () => {
  const salvarCompra = () =>
    repos.compras.salvar({
      cartaoId: ids.roxo,
      descricao: 'Tênis',
      categoriaId: null,
      valorTotal: 30_000,
      numParcelas: 3,
      dataCompra: '2026-10-26',
      recorrente: false,
      rateios: [],
    });

  it('regenera as parcelas e desfaz', async () => {
    const id = await salvarCompra();
    await abrirApp();

    act(() => {
      useApp.getState().editarCompra(id);
    });
    const sheet = await screen.findByRole('dialog', { name: 'Editar compra' });
    await waitFor(() => {
      expect(within(sheet).getByLabelText('Valor')).toHaveValue('300,00');
    });
    fireEvent.click(within(sheet).getByRole('button', { name: '2×' }));
    fireEvent.click(within(sheet).getByRole('button', { name: /Salvar/ }));

    expect(await screen.findByText('Compra atualizada')).toBeInTheDocument();
    expect((await repos.compras.buscar(id)).parcelas.map((p) => p.competencia)).toEqual([
      '2026-10',
      '2026-11',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect((await repos.compras.buscar(id)).numParcelas).toBe(3);
    });
  });

  it('só a descrição mantém as parcelas mesmo se o fechamento mudou', async () => {
    const id = await salvarCompra();
    await repos.cartoes.atualizar(ids.roxo, { diaFechamento: 25 });
    await abrirApp();

    act(() => {
      useApp.getState().editarCompra(id);
    });
    const sheet = await screen.findByRole('dialog', { name: 'Editar compra' });
    await waitFor(() => {
      expect(within(sheet).getByLabelText('Descrição')).toHaveValue('Tênis');
    });
    fireEvent.change(within(sheet).getByLabelText('Descrição'), {
      target: { value: 'Tênis novo' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: /Salvar/ }));

    await screen.findByText('Compra atualizada');
    expect(await repos.compras.buscar(id)).toMatchObject({
      descricao: 'Tênis novo',
      parcelas: [
        { numero: 1, competencia: '2026-10' },
        { numero: 2, competencia: '2026-11' },
        { numero: 3, competencia: '2026-12' },
      ],
    });
  });

  it('avisa quando a compra tem parcelas em fatura paga', async () => {
    const id = await salvarCompra();
    await repos.faturas.marcarComoPaga({
      cartaoId: ids.roxo,
      competencia: '2026-10',
      pagoEm: '2026-10-20',
      valorPagoCentavos: 10_000,
    });
    await abrirApp();

    act(() => {
      useApp.getState().editarCompra(id);
    });

    expect(
      await screen.findByText(
        'Esta compra tem parcelas em faturas já pagas: Outubro. Alterar muda o total delas.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Restrição de digitação', () => {
  it('o valor só aceita números, ponto de milhar e uma vírgula com 2 casas', async () => {
    await abrirApp();
    const dialog = await abrirDialog();
    const valor = within(dialog).getByLabelText('Valor');

    fireEvent.input(valor, { target: { value: 'abc12,345' } });
    expect(valor).toHaveValue('12,34');
  });
});
