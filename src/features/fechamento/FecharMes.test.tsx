import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { useApp } from '@/app/store';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import { MesFechado } from '@/data/repositories';
import type { Repositorios } from '@/data';
import { Toaster } from '@/components/ui/sonner';
import { executar } from '@/features/cadastros/SecaoCadastro';

let repos: Repositorios;
let ids: { roxo: number; ana: number; jantar: number };

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/fechar/2026-10'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Fechar o mês' });
  return router;
}

const etapa = () => screen.getByRole('list', { name: 'Etapas do fechamento' });
const avancar = () => {
  fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
};
const extrato = (linhas: string) =>
  new File([`Data;Descrição;Valor\n${linhas}`], 'fatura-roxo.csv', { type: 'text/csv' });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 3, 10));
  useApp.setState({ competencia: '2026-11', legendaDaPagina: null });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    configurable: true,
  });
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
  const compra = (descricao: string, dataCompra: string, valorTotal: number, deAna = false) =>
    repos.compras.salvar({
      cartaoId: roxo,
      descricao,
      categoriaId: null,
      valorTotal,
      numParcelas: 1,
      dataCompra,
      recorrente: false,
      rateios: deAna ? [{ terceiroId: ana, percentual: 100 }] : [],
    });
  await compra('Supermercado', '2026-10-12', 48_730);
  const jantar = await compra('Jantar de aniversário', '2026-10-18', 32_000, true);
  ids = { roxo, ana, jantar };
  await repos.receitas.criar({
    descricao: 'Salário',
    valorCentavos: 300_000,
    competencia: '2026-01',
    competenciaFim: null,
    recorrente: true,
  });
  await repos.economias.metas.definir({ valorCentavos: 80_000, inicio: '2026-01' });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Fechar o mês', () => {
  it('confere a fatura com o extrato, corrige a diferença e adiciona o que faltava', async () => {
    await abrir();

    const arquivo = extrato(
      '12/10/2026;SUPERMERCADO PAO DE ACUCAR;487,30\n18/10/2026;RESTAURANTE JANTAR;330,00\n25/10/2026;IOF COMPRA;3,80\n06/10/2026;PAGAMENTO;-900,00',
    );
    fireEvent.change(await screen.findByLabelText('Escolher arquivo'), {
      target: { files: [arquivo] },
    });

    expect(await screen.findByText(/2 diferenças entre o Fechô e o extrato/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Usar valor do banco' }));
    await waitFor(async () => {
      expect((await repos.compras.buscar(ids.jantar)).valorTotal).toBe(33_000);
    });
    fireEvent.click(await screen.findByRole('button', { name: /Adicionar ao Fechô/ }));

    expect(await screen.findByText(/Bateu! O Fechô e o extrato/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como conferida' }));
    await waitFor(async () => {
      expect(await repos.fechamento.conferencias()).toEqual([
        {
          cartaoId: ids.roxo,
          competencia: '2026-10',
          extrato: 'fatura-roxo.csv',
          conferidaEm: '2026-11-03',
        },
      ]);
    });
    expect(etapa()).toHaveTextContent('Tudo conferido');
  });

  it('confere sem extrato quando o banco só dá PDF', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Conferir sem extrato' }));

    expect(await screen.findByText(/conferida em 03\/11 sem extrato/)).toBeVisible();
  });

  it('pagar menos joga o saldo para a próxima fatura, e desfazer tira os dois', async () => {
    await abrir();
    avancar();

    const roxo = await screen.findByRole('region', { name: 'Fatura do Cartão Roxo' });
    fireEvent.change(within(roxo).getByLabelText('Valor pago'), { target: { value: '500,00' } });
    fireEvent.click(within(roxo).getByRole('button', { name: 'Marcar paga' }));

    expect(await screen.findByText(/R\$\s307,30 foram para a fatura de Novembro/)).toBeVisible();
    expect((await repos.faturas.pagamentos())[0]).toMatchObject({ valorPagoCentavos: 50_000 });
    expect(
      (await repos.compras.parcelasDaCompetencia('2026-11')).map((p) => [
        p.descricao,
        p.valorCentavos,
      ]),
    ).toEqual([['Saldo da fatura de Outubro', 30_730]]);

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect(await repos.faturas.pagamentos()).toEqual([]);
    });
    expect(await repos.compras.parcelasDaCompetencia('2026-11')).toEqual([]);
  });

  it('registra o depósito de quem deve e guarda a economia do mês', async () => {
    await abrir();
    avancar();
    avancar();

    const ana = within(await screen.findByRole('region', { name: 'Terceiros' })).getByRole(
      'listitem',
    );
    expect(ana).toHaveTextContent(/Ana.*R\$\s320,00/);
    fireEvent.click(within(ana).getByRole('button', { name: 'Recebi' }));
    expect(await screen.findByText('Ninguém deve nada de Outubro.')).toBeVisible();

    avancar();
    const campo = await screen.findByLabelText('Quanto você guardou em Outubro?');
    fireEvent.change(campo, { target: { value: '300,00' } });
    fireEvent.blur(campo);

    await waitFor(async () => {
      expect(await repos.economias.movimentos.listar()).toMatchObject([
        { data: '2026-10-31', valorCentavos: 30_000, objetivoId: null },
      ]);
    });
    expect(
      screen.getByText(/Faltaram R\$\s500,00\. Tudo bem, Novembro é outro mês\./),
    ).toBeVisible();
  });

  it('fecha o mês, trava as compras e reabre', async () => {
    const router = await abrir();
    avancar();
    avancar();
    avancar();
    fireEvent.click(await screen.findByRole('button', { name: /Fechar Outubro/ }));

    expect(await screen.findByRole('heading', { name: 'Outubro fechado' })).toBeVisible();
    expect(await repos.fechamento.fechados()).toEqual(['2026-10']);
    await expect(repos.compras.excluir(ids.jantar)).rejects.toBeInstanceOf(MesFechado);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Mais ações de Outubro' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reabrir Outubro' }));
    await waitFor(async () => {
      expect(await repos.fechamento.fechados()).toEqual([]);
    });
    expect(await screen.findByRole('list', { name: 'Etapas do fechamento' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar e sair' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('volta para a etapa em que parou', async () => {
    await repos.preferencias.gravar({ etapaDoFechamento: { competencia: '2026-10', etapa: 3 } });
    await abrir();

    expect(await screen.findByLabelText('Quanto você guardou em Outubro?')).toBeVisible();
  });
});

describe('Aviso de mês fechado', () => {
  it('mostra o aviso com Reabrir em vez do erro genérico', async () => {
    render(<Toaster />);
    await executar(() => Promise.reject(new MesFechado('2026-10')));

    const aviso = await screen.findByText('Outubro está fechado. Reabra o mês para mudar.');
    expect(aviso).toBeVisible();
  });
});
