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
let ids: { roxo: number; azul: number; verde: number; ana: number };

async function abrir(caminho = '/faturas') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Faturas' });
  return router;
}

const lista = () => screen.getByRole('listbox', { name: 'Cartões' });
const opcao = (nome: RegExp) => within(lista()).getByRole('option', { name: nome });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', novaCompraAberta: false, legendaDaPagina: null });
  repos = criarRepositoriosEmMemoria();
  const cartao = (nome: string, diaFechamento: number, diaVencimento: number, cor: string) =>
    repos.cartoes.criar({
      nome,
      diaFechamento,
      diaVencimento,
      limiteCentavos: 500_000,
      cor,
      ativo: true,
    });
  ids = {
    roxo: await cartao('Cartão Roxo', 28, 5, '#8B5CF6'),
    azul: await cartao('Cartão Azul', 3, 10, '#3B82F6'),
    verde: await cartao('Cartão Verde-água', 20, 28, '#14B8A6'),
    ana: await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true }),
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
  await compra({ descricao: 'Supermercado', valorTotal: 48_730 });
  await compra({
    descricao: 'Tênis',
    valorTotal: 129_900,
    numParcelas: 6,
    dataCompra: '2026-10-02',
    rateios: [
      { terceiroId: null, percentual: 50 },
      { terceiroId: ids.ana, percentual: 50 },
    ],
  });
  await compra({
    descricao: 'Jantar',
    valorTotal: 32_000,
    dataCompra: '2026-10-18',
    recorrente: true,
    rateios: [{ terceiroId: ids.ana, percentual: 100 }],
  });
  await compra({
    cartaoId: ids.azul,
    descricao: 'Notebook',
    valorTotal: 480_000,
    numParcelas: 10,
    dataCompra: '2026-06-15',
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Faturas', () => {
  it('lista os cartões do mês com total, vencimento e status', async () => {
    await abrir();

    expect(
      await screen.findByText('Outubro 2026 · 2 faturas abertas, vencem até 05/11'),
    ).toBeInTheDocument();
    expect(opcao(/Cartão Roxo/)).toHaveTextContent('Vence 05/11 · em 16 dias');
    expect(opcao(/Cartão Roxo/)).toHaveTextContent('R$ 1.023,80');
    expect(opcao(/Cartão Roxo/)).toHaveTextContent('Pendente');
    expect(opcao(/Cartão Azul/)).toHaveTextContent('Venceu há 10 dias');
    expect(opcao(/Cartão Azul/)).toHaveTextContent('Atrasada');
    expect(opcao(/Cartão Verde-água/)).toHaveTextContent('Sem compras em Outubro');
    expect(opcao(/Cartão Roxo/)).toHaveAttribute('aria-selected', 'true');
  });

  it('mostra tiles e uma linha por dono, e filtra pelo segmented', async () => {
    await abrir();

    expect(await screen.findByText('Total da fatura')).toBeInTheDocument();
    expect(screen.getByText('R$ 595,55')).toBeInTheDocument();
    expect(screen.getByText('R$ 428,25')).toBeInTheDocument();
    expect(screen.getByText('Faltam R$ 428,25')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Faltam R$ 428,25 de Ana para fechar a fatura do Cartão RoxoVer em A receber',
    );
    expect(
      screen.getByText(/Fecha 28\/10 · Vence 05\/11 · limite usado 20% de R\$ 5\.000,00/),
    ).toBeInTheDocument();

    const tabela = screen.getByRole('table');
    expect(within(tabela).getAllByRole('row')).toHaveLength(5);
    expect(within(tabela).getAllByRole('row', { name: /Tênis/ })).toHaveLength(2);
    expect(within(tabela).getByRole('row', { name: /Jantar/ })).toHaveTextContent('Ana');

    fireEvent.click(screen.getByRole('radio', { name: 'Terceiros' }));
    await waitFor(() => {
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Meu' }));
    expect(within(screen.getByRole('table')).queryAllByRole('row', { name: /Ana/ })).toHaveLength(
      0,
    );
  });

  it('quando a pessoa deposita tudo, some o alerta e o tile diz que todos depositaram', async () => {
    const parcelas = await repos.compras.parcelasDeTerceiros('2026-10');
    await repos.receber.registrarDeposito({
      terceiroId: ids.ana,
      valorCentavos: 42_825,
      data: '2026-10-19',
      competencia: '2026-10',
      abatimentos: parcelas
        .filter((p) => p.cartaoId === ids.roxo && p.rateios.some((r) => r.terceiroId === ids.ana))
        .map((p) => ({
          compraId: p.compraId,
          numero: p.numero,
          valor: p.descricao === 'Tênis' ? 10_825 : 32_000,
        })),
    });
    await abrir();

    expect(await screen.findByText('Todos já depositaram')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marca como paga e desfaz', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como paga' }));

    expect(await screen.findAllByText('Paga em 20/10')).toHaveLength(2);
    expect(await screen.findByText('Fatura do Cartão Roxo marcada como paga')).toBeInTheDocument();
    expect(await repos.faturas.pagamentos()).toEqual([
      {
        cartaoId: ids.roxo,
        competencia: '2026-10',
        pagoEm: '2026-10-20',
        valorPagoCentavos: 102_380,
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByRole('button', { name: 'Marcar como paga' })).toBeInTheDocument();
    expect(await repos.faturas.pagamentos()).toEqual([]);
  });

  it('avisa o que foi lançado depois do pagamento', async () => {
    await repos.faturas.marcarComoPaga({
      cartaoId: ids.roxo,
      competencia: '2026-10',
      pagoEm: '2026-10-15',
      valorPagoCentavos: 100_000,
    });
    await abrir();

    expect(
      await screen.findByText(/R\$ 23,80 lançados depois do pagamento em 15\/10\/2026/),
    ).toBeInTheDocument();
    expect(screen.getByText('Outubro 2026 · 1 fatura aberta, vence em 10/10')).toBeInTheDocument();
  });

  it('troca de cartão pelo teclado e guarda a escolha na URL', async () => {
    const router = await abrir();
    await screen.findByRole('heading', { level: 2, name: 'Cartão Roxo' });

    opcao(/Cartão Roxo/).focus();
    fireEvent.keyDown(opcao(/Cartão Roxo/), { key: 'ArrowDown' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Cartão Azul' }),
    ).toBeInTheDocument();
    expect(opcao(/Cartão Azul/)).toHaveFocus();
    expect(router.state.location.search).toBe(`?cartao=${ids.azul}`);
  });

  it('desenha o cartão no cabeçalho da fatura', async () => {
    await repos.cartoes.atualizar(ids.roxo, {
      banco: 'Banco Aurora',
      final: '4821',
      bandeira: 'visa',
    });
    await abrir();

    expect(
      await screen.findByRole('img', { name: 'Cartão Roxo, Banco Aurora, final 4821, Visa' }),
    ).toBeInTheDocument();
  });

  it('cartão sem compras oferece registrar uma', async () => {
    await abrir(`/faturas?cartao=${ids.verde}`);

    expect(
      await screen.findByText('Nenhuma compra no Cartão Verde-água em Outubro.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));

    expect(await screen.findByRole('dialog', { name: 'Nova compra' })).toBeInTheDocument();
  });

  it('recarrega ao trocar o mês', async () => {
    await abrir();
    await screen.findByText(/2 faturas abertas/);

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });

    expect(
      await screen.findByText('Novembro 2026 · 2 faturas abertas, vencem até 05/12'),
    ).toBeInTheDocument();
    expect(opcao(/Cartão Roxo/)).toHaveTextContent('R$ 216,50');
  });

  it('Nova compra avisa quando a data cai numa fatura paga', async () => {
    await repos.faturas.marcarComoPaga({
      cartaoId: ids.roxo,
      competencia: '2026-10',
      pagoEm: '2026-10-15',
      valorPagoCentavos: 102_380,
    });
    await abrir();

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

    expect(
      await screen.findByText(
        /A fatura de Outubro do Cartão Roxo já foi paga\. A compra entra nela mesmo assim\./,
      ),
    ).toBeInTheDocument();
  });

  it('sem cartões, leva ao cadastro', async () => {
    repos = criarRepositoriosEmMemoria();
    const router = await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/configuracoes');
    });
  });
});
