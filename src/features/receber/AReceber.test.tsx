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
let ids: { roxo: number; ana: number; bruno: number };
const writeText = vi.fn<(texto: string) => Promise<void>>();

async function abrir(caminho = '/receber') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'A receber' });
  return router;
}

const lista = () => screen.findByRole('listbox', { name: 'Pessoas' });
const opcao = async (nome: RegExp) => within(await lista()).getByRole('option', { name: nome });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', novaCompraAberta: false, legendaDaPagina: null });
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
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
    bruno: await repos.terceiros.criar({ nome: 'Bruno', cor: '#2563EB', ativo: true }),
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
    rateios: [{ terceiroId: ids.ana, percentual: 100 }],
  });
  await compra({
    descricao: 'Show',
    valorTotal: 15_000,
    dataCompra: '2026-09-10',
    rateios: [{ terceiroId: ids.bruno, percentual: 100 }],
  });
  await compra({ descricao: 'Supermercado', valorTotal: 48_730 });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('A receber', () => {
  it('lista quem deve, com o atrasado primeiro e o prazo de cada um', async () => {
    await abrir();

    const pessoas = within(await lista()).getAllByRole('option');
    expect(pessoas.map((p) => p.textContent)).toEqual([
      expect.stringMatching(/^BBrunoR\$\s150,00Cartão Roxo · até 05\/10Atrasado$/),
      expect.stringMatching(/^AAnaR\$\s428,25Cartão Roxo · até 05\/11Pendente$/),
    ]);
    expect(pessoas[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Faltam R$ 150,00 de Bruno para fechar a fatura do Cartão Roxo, que venceu em 05/10.',
    );
  });

  it('Recebi quita tudo em aberto e o Desfazer apaga o depósito', async () => {
    await abrir(`/receber?pessoa=${String(ids.ana)}`);
    await lista();

    fireEvent.click(screen.getByRole('button', { name: /^Recebi R\$\s428,25$/ }));

    expect(await opcao(/Ana.*Pago/)).toBeInTheDocument();
    expect(screen.getByText('Depositou R$ 428,25')).toBeInTheDocument();
    const [deposito] = await repos.receber.movimentos();
    expect(deposito).toMatchObject({ valorCentavos: 42_825, data: '2026-10-20' });
    expect(deposito?.abatimentos).toHaveLength(2);

    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    expect(await opcao(/Ana.*Pendente/)).toBeInTheDocument();
    expect(await repos.receber.movimentos()).toEqual([]);
  });

  it('outro valor abate só as compras marcadas e deixa a pessoa em Parcial', async () => {
    await abrir(`/receber?pessoa=${String(ids.ana)}`);
    await lista();

    fireEvent.click(screen.getByRole('button', { name: 'Outro valor' }));
    const valor = await screen.findByLabelText('Quanto Ana depositou?');
    fireEvent.change(valor, { target: { value: '108,25' } });

    expect(screen.getByText('Fica faltando R$ 320,00 · status vira Parcial')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Tênis 1\/6/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Jantar/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar depósito' }));

    expect(await opcao(/Ana.*R\$\s320,00.*Parcial/)).toBeInTheDocument();
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas.map((l) => l.textContent)).toEqual([
      expect.stringMatching(/JantarCartão RoxoR\$\s320,00Pendente/),
      expect.stringMatching(/Tênis1\/6Cartão RoxoR\$\s108,25Pago/),
    ]);
  });

  it('Copiar cobrança monta a mensagem do modelo e registra no histórico', async () => {
    await repos.preferencias.gravar({ chavePix: 'ana@pix' });
    await abrir(`/receber?pessoa=${String(ids.ana)}`);
    await lista();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar cobrança' }));

    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(writeText.mock.calls[0]?.[0].replaceAll(' ', ' ')).toBe(
      'Oi, Ana! Faltam R$ 428,25 das suas compras no meu Cartão Roxo, que vence em 05/11. Meu Pix: ana@pix',
    );
    expect(await screen.findByText('Cobrança copiada · R$ 428,25')).toBeInTheDocument();
  });

  it('avisa quando não consegue copiar e oferece tentar de novo', async () => {
    writeText.mockRejectedValueOnce(new Error('bloqueado'));
    await abrir(`/receber?pessoa=${String(ids.ana)}`);
    await lista();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar cobrança' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('atalhos: Ctrl+Shift+C copia, Ctrl+Enter recebe tudo, Ctrl+Z desfaz e Ctrl+R abre outro valor', async () => {
    await abrir(`/receber?pessoa=${String(ids.ana)}`);
    await lista();

    fireEvent.keyDown(window, { key: 'C', ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(await opcao(/Ana.*Pago/)).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(await opcao(/Ana.*Pendente/)).toBeInTheDocument();
    expect((await repos.receber.movimentos()).map((m) => m.tipo)).toEqual(['cobranca']);

    fireEvent.keyDown(document.body, { key: 'r', ctrlKey: true });
    expect(await screen.findByLabelText('Quanto Ana depositou?')).toBeInTheDocument();
  });

  it('Ctrl+R em outra tela vai para A receber com o outro valor aberto', async () => {
    const router = createMemoryRouter(rotas, { initialEntries: ['/faturas'] });
    render(
      <RepositoriosProvider criar={() => Promise.resolve(repos)}>
        <RouterProvider router={router} />
      </RepositoriosProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Faturas' });

    fireEvent.keyDown(document.body, { key: 'r', ctrlKey: true });

    expect(await screen.findByLabelText('Quanto Bruno depositou?')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/receber');
  });

  it('mostra o estado vazio quando ninguém deve nada', async () => {
    repos = criarRepositoriosEmMemoria();
    await abrir();

    expect(await screen.findByText('Ninguém te deve nada neste mês.')).toBeInTheDocument();
  });
});

describe('Conta fixa dividida em A receber', () => {
  let bia: number;

  beforeEach(async () => {
    bia = await repos.terceiros.criar({ nome: 'Bia', cor: '#2563EB', ativo: true });
    await repos.preferencias.gravar({ chavePix: 'eu@pix' });
    await repos.contasFixas.criar({
      descricao: 'Aluguel',
      categoriaId: null,
      valorCentavos: 180_000,
      dia: 25,
      inicio: '2026-10',
      ativa: true,
      rateios: [
        { terceiroId: null, percentual: 50 },
        { terceiroId: bia, percentual: 50 },
      ],
    });
  });

  it('mostra a parte da pessoa, cobra com o texto da conta e quita pelo Recebi', async () => {
    await abrir(`/receber?pessoa=${String(bia)}`);

    expect(await opcao(/Bia.*R\$\s900,00/)).toBeInTheDocument();
    expect(
      await screen.findByText(/Faltam R\$\s900,00 de Bia na conta Aluguel, que vence em 25\/10\./),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar cobrança' }));
    await waitFor(() => {
      expect(writeText.mock.calls[0]?.[0].replaceAll(' ', ' ')).toBe(
        'Oi, Bia! Faltam R$ 900,00 da sua parte da conta Aluguel, que vence em 25/10. Meu Pix: eu@pix',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /^Recebi R\$\s900,00$/ }));
    expect(await opcao(/Bia.*Pago/)).toBeInTheDocument();
    const deposito = (await repos.receber.movimentos()).find((m) => m.tipo === 'deposito');
    expect(deposito?.abatimentos).toEqual([
      { contaFixaId: expect.any(Number) as number, competencia: '2026-10', valor: 90_000 },
    ]);
  });
});
