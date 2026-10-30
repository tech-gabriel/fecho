import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
let ids: { roxo: number; azul: number; ana: number; salario: number; freela: number };

async function abrir(caminho = '/') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
  return router;
}

const caixa = () => screen.getByRole('region', { name: 'Preciso ter em caixa' });
const kpi = (nome: RegExp) => within(screen.getByRole('main')).getByRole('link', { name: nome });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', legendaDaPagina: null, novaCompraAberta: false });
  repos = criarRepositoriosEmMemoria();
  const cartao = (nome: string, diaFechamento: number, diaVencimento: number, cor: string) =>
    repos.cartoes.criar({
      nome,
      diaFechamento,
      diaVencimento,
      limiteCentavos: 0,
      cor,
      ativo: true,
    });
  const roxo = await cartao('Cartão Roxo', 28, 5, '#8B5CF6');
  const azul = await cartao('Cartão Azul', 3, 10, '#3B82F6');
  const ana = await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true });
  const compra = (dados: Partial<DadosNovaCompra>) =>
    repos.compras.salvar({
      cartaoId: roxo,
      descricao: 'Compra',
      categoriaId: null,
      valorTotal: 1_000,
      numParcelas: 1,
      dataCompra: '2026-10-12',
      recorrente: false,
      rateios: [],
      ...dados,
    });
  await compra({ descricao: 'Supermercado', valorTotal: 48_730 });
  await compra({
    descricao: 'Tênis',
    valorTotal: 129_900,
    numParcelas: 6,
    dataCompra: '2026-10-02',
    rateios: [
      { terceiroId: null, percentual: 50 },
      { terceiroId: ana, percentual: 50 },
    ],
  });
  await compra({
    descricao: 'Jantar',
    valorTotal: 32_000,
    dataCompra: '2026-10-18',
    rateios: [{ terceiroId: ana, percentual: 100 }],
  });
  await compra({
    cartaoId: azul,
    descricao: 'Notebook',
    valorTotal: 480_000,
    numParcelas: 10,
    dataCompra: '2026-06-15',
  });
  const salario = await repos.receitas.criar({
    descricao: 'Salário',
    valorCentavos: 650_000,
    competencia: '2026-01',
    competenciaFim: null,
    recorrente: true,
  });
  const freela = await repos.receitas.criar({
    descricao: 'Freela',
    valorCentavos: 70_000,
    competencia: '2026-10',
    competenciaFim: null,
    recorrente: false,
  });
  ids = { roxo, azul, ana, salario, freela };
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Dashboard', () => {
  it('mostra quanto ter em caixa, de onde vem e os três números do mês', async () => {
    await abrir();

    await screen.findByText('Preciso ter em caixa');
    expect(caixa()).toHaveTextContent('até 05/11');
    expect(caixa()).toHaveTextContent('R$ 1.503,80');
    expect(caixa()).toHaveTextContent('R$ 1.503,80 em 2 faturas.');
    expect(caixa()).toHaveTextContent('R$ 428,25 voltam de Ana.');
    expect(screen.getByRole('button', { name: /Renda/ })).toHaveTextContent('R$ 7.200,00');
    expect(kpi(/Meus gastos/)).toHaveTextContent('R$ 1.075,55');
    expect(kpi(/Meus gastos/)).toHaveTextContent('15% da renda');
    expect(kpi(/Meus gastos/)).toHaveAttribute('href', '/lancamentos?ver=meu');
    expect(kpi(/Saldo real/)).toHaveTextContent('R$ 6.124,45');
    expect(kpi(/voltam de Ana/)).toHaveAttribute('href', '/receber');
  });

  it('mostra cada fatura na carteira, atrasada primeiro, com o seu e o de cada pessoa', async () => {
    await abrir();

    const carteira = await screen.findByRole('list', { name: 'Faturas por cartão' });
    const itens = within(carteira).getAllByRole('listitem');
    expect(itens.map((i) => i.getAttribute('aria-label'))).toEqual(['Cartão Azul', 'Cartão Roxo']);
    expect(itens[0]).toHaveTextContent('Atrasada');
    expect(itens[0]).toHaveTextContent('Tudo seu');
    expect(itens[1]).toHaveTextContent(/Seu R\$\s595,55/);
    expect(itens[1]).toHaveTextContent(/Ana R\$\s428,25/);
    expect(
      within(itens[1] as HTMLElement).getByRole('link', { name: /Ver fatura do Cartão Roxo/ }),
    ).toHaveAttribute('href', `/faturas?cartao=${String(ids.roxo)}`);
  });

  it('marca a fatura como paga na carteira, com Desfazer', async () => {
    await abrir();

    const carteira = await screen.findByRole('list', { name: 'Faturas por cartão' });
    const azul = within(carteira).getByRole('listitem', { name: 'Cartão Azul' });
    fireEvent.click(within(azul).getByRole('button', { name: 'Marcar paga' }));

    await waitFor(async () => {
      expect(await repos.faturas.pagamentos()).toEqual([
        expect.objectContaining({ cartaoId: ids.azul, valorPagoCentavos: 48_000 }),
      ]);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect(await repos.faturas.pagamentos()).toEqual([]);
    });
  });

  it('cobra a pessoa direto do cartão', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await abrir();

    const carteira = await screen.findByRole('list', { name: 'Faturas por cartão' });
    const roxo = within(carteira).getByRole('listitem', { name: 'Cartão Roxo' });
    fireEvent.click(within(roxo).getByRole('button', { name: 'Cobrar Ana' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Cartão Roxo'));
    });
  });

  it('lista os cartões sem compra no mês numa linha só', async () => {
    await repos.cartoes.criar({
      nome: 'Cartão Rosa',
      diaFechamento: 20,
      diaVencimento: 28,
      limiteCentavos: 0,
      cor: '#EC4899',
      ativo: true,
    });
    await abrir();

    expect(await screen.findByText(/Sem fatura em Outubro:/)).toHaveTextContent(
      'Sem fatura em Outubro: Cartão Rosa',
    );
  });

  it('a renda comprometida continua no fim', async () => {
    await abrir();

    const tabela = await screen.findByRole('table', {
      name: 'Renda comprometida nos próximos 6 meses',
    });
    expect(within(tabela).getByRole('row', { name: /Novembro 2026/ })).toHaveTextContent(
      'R$ 588,25R$ 0,00R$ 0,00R$ 0,009%',
    );
  });

  it('projeta a minha parte das assinaturas nos meses seguintes', async () => {
    await repos.assinaturas.criar({
      nome: 'Nuvem 2 TB',
      cartaoId: ids.roxo,
      categoriaId: null,
      valorCentavos: 2_940,
      dia: 25,
      rateios: [
        { terceiroId: null, percentual: 50 },
        { terceiroId: ids.ana, percentual: 50 },
      ],
      ativa: true,
      inicio: '2026-10',
    });
    await abrir();

    const tabela = await screen.findByRole('table', {
      name: 'Renda comprometida nos próximos 6 meses',
    });
    expect(within(tabela).getByRole('row', { name: /Novembro 2026/ })).toHaveTextContent(
      /R\$\s588,25R\$\s14,70/,
    );
  });

  it('com as faturas pagas não há nada a separar', async () => {
    for (const [cartaoId, valor] of [
      [ids.roxo, 102_380],
      [ids.azul, 48_000],
    ] as const) {
      await repos.faturas.marcarComoPaga({
        cartaoId,
        competencia: '2026-10',
        pagoEm: '2026-10-05',
        valorPagoCentavos: valor,
      });
    }
    await abrir();

    await screen.findByText('Preciso ter em caixa');
    expect(caixa()).toHaveTextContent('R$ 0,00');
    expect(caixa()).toHaveTextContent('Tudo de Outubro pago.');
  });

  it('saldo negativo aparece com sinal de menos', async () => {
    await repos.receitas.excluir(ids.salario);
    await repos.receitas.excluir(ids.freela);
    await abrir();

    expect(await screen.findByText('−R$ 1.075,55')).toBeInTheDocument();
  });

  it('cadastra renda avulsa pelo KPI e o valor atualiza', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: /Renda/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Renda de Outubro' });
    expect(within(dialog).getByText('Total de Outubro').nextSibling).toHaveTextContent(
      'R$ 7.200,00',
    );
    fireEvent.change(within(dialog).getByLabelText('De onde vem'), { target: { value: 'Bônus' } });
    fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '1.000,00' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Só neste mês' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Bônus adicionada')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).getByText('Total de Outubro').nextSibling).toHaveTextContent(
        'R$ 8.200,00',
      );
    });
    expect((await repos.receitas.listar()).at(-1)).toMatchObject({
      recorrente: false,
      competencia: '2026-10',
    });
  });

  it('alterar o salário vale deste mês em diante', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: /Renda/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Renda de Outubro' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alterar valor de Salário' }));
    const campo = within(dialog).getByLabelText('Novo valor de Salário');
    fireEvent.change(campo, { target: { value: '7.000,00' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByText('Salário alterada a partir de Outubro')).toBeInTheDocument();
    const receitas = await repos.receitas.listar();
    expect(receitas.find((r) => r.id === ids.salario)).toMatchObject({ competenciaFim: '2026-09' });
    expect(receitas.at(-1)).toMatchObject({
      valorCentavos: 700_000,
      competencia: '2026-10',
      recorrente: true,
    });
  });

  it('remover a recorrente encerra no mês anterior, com Desfazer', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: /Renda/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Renda de Outubro' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover Salário' }));

    expect(await screen.findByText('Salário encerrada a partir de Outubro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect(
        (await repos.receitas.listar()).find((r) => r.id === ids.salario)?.competenciaFim,
      ).toBeNull();
    });
  });

  it('mês sem compras nem renda oferece registrar', async () => {
    repos = criarRepositoriosEmMemoria();
    await abrir();

    expect(await screen.findByText('Nada lançado em Outubro ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar renda' })).toBeInTheDocument();
  });
});

describe('Contas fixas no Dashboard', () => {
  beforeEach(async () => {
    await repos.contasFixas.criar({
      descricao: 'Aluguel',
      categoriaId: null,
      valorCentavos: 180_000,
      dia: 10,
      inicio: '2026-10',
      ativa: true,
      rateios: [],
    });
  });

  it('soma a conta pendente no caixa, nos gastos e no saldo real', async () => {
    await abrir();

    await screen.findByText('Preciso ter em caixa');
    expect(caixa()).toHaveTextContent('R$ 3.303,80');
    expect(caixa()).toHaveTextContent('R$ 1.503,80 em 2 faturas e R$ 1.800,00 em 1 conta.');
    expect(kpi(/Meus gastos/)).toHaveTextContent('R$ 2.875,55');
    expect(kpi(/Saldo real/)).toHaveTextContent('R$ 4.324,45');
  });

  it('mostra a conta em Fora do cartão e marca como paga', async () => {
    await abrir();

    const fora = await screen.findByRole('region', { name: 'Fora do cartão' });
    const aluguel = await within(fora).findByRole('listitem', { name: /Aluguel/ });
    expect(aluguel).toHaveTextContent('Venceu 10/10');
    fireEvent.click(within(aluguel).getByRole('button', { name: 'Marcar Aluguel como paga' }));

    await waitFor(async () => {
      expect(await repos.contasFixas.pagamentos()).toEqual([
        expect.objectContaining({ competencia: '2026-10', valorCentavos: 180_000 }),
      ]);
    });
    await waitFor(() => {
      expect(caixa()).toHaveTextContent('R$ 1.503,80');
    });
  });
});

describe('Orçamento no Dashboard', () => {
  const orcamento = () => screen.findByRole('region', { name: 'Orçamento de Outubro' });

  it('convida a definir limites quando nenhuma categoria tem', async () => {
    await abrir();

    expect(
      await within(await orcamento()).findByRole('link', { name: 'Ir para Categorias' }),
    ).toHaveAttribute('href', '/configuracoes?secao=categorias');
  });

  it('mostra cada categoria com limite, perto e estourada, contando só a minha parte', async () => {
    const lazer = await repos.categorias.criar({
      nome: 'Lazer',
      icone: 'tag',
      limiteCentavos: 10_000,
      ativo: true,
    });
    const casa = await repos.categorias.criar({
      nome: 'Casa',
      icone: 'tag',
      limiteCentavos: 20_000,
      ativo: true,
    });
    const [roxo] = await repos.cartoes.listar();
    const compra = (categoriaId: number, valorTotal: number) =>
      repos.compras.salvar({
        cartaoId: roxo?.id ?? 0,
        descricao: 'Compra',
        categoriaId,
        valorTotal,
        numParcelas: 1,
        dataCompra: '2026-10-12',
        recorrente: false,
        rateios: [
          { terceiroId: null, percentual: 50 },
          { terceiroId: ids.ana, percentual: 50 },
        ],
      });
    await compra(lazer, 24_000);
    await compra(casa, 34_000);
    await abrir();

    const lista = within(await orcamento());
    expect(
      (await lista.findByRole('progressbar', { name: 'Lazer' })).getAttribute('aria-valuetext'),
    ).toMatch(/^R\$\s120,00 de R\$\s100,00$/);
    expect(lista.getByText('Passou R$ 20,00')).toBeInTheDocument();
    expect(lista.getByRole('progressbar', { name: 'Casa' })).toHaveAttribute('aria-valuenow', '85');
    expect(lista.getByText('Perto do limite')).toBeInTheDocument();
  });
});
