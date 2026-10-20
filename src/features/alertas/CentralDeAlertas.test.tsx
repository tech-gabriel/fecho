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
import { notificarNoWindows } from './notificar';

vi.mock('./notificar', () => ({
  notificarNoWindows: vi.fn((avisos: { chave: string }[]) =>
    Promise.resolve(avisos.map((a) => a.chave)),
  ),
}));

let repos: Repositorios;
let ids: { roxo: number; ana: number };
const writeText = vi.fn<(texto: string) => Promise<void>>();

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
  return router;
}

const sino = (nome: string | RegExp = /^Alertas/) => screen.findByRole('button', { name: nome });
const abrirSino = async () => {
  fireEvent.click(await sino());
  return within(await screen.findByRole('dialog'));
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 2, 10));
  useApp.setState({ competencia: '2026-11', legendaDaPagina: null });
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
  };
  await repos.cartoes.criar({
    nome: 'Cartão Azul',
    diaFechamento: 3,
    diaVencimento: 10,
    limiteCentavos: 0,
    cor: '#3B82F6',
    ativo: true,
  });
  await repos.compras.salvar({
    cartaoId: ids.roxo,
    descricao: 'Jantar',
    categoriaId: null,
    valorTotal: 32_000,
    numParcelas: 1,
    dataCompra: '2026-10-12',
    recorrente: false,
    rateios: [{ terceiroId: ids.ana, percentual: 100 }],
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Central de alertas', () => {
  it('mostra no sino quantos alertas são novos e lista cada um', async () => {
    await abrir();

    const central = await abrirSino();
    expect(await sino('Alertas, 3 novos')).toBeInTheDocument();
    expect(central.getByText('3 novas')).toBeInTheDocument();
    expect(
      central.getByText(/Faltam R\$\s320,00 de Ana para fechar a fatura do Cartão Roxo/),
    ).toBeInTheDocument();
    expect(central.getByText('A fatura do Cartão Roxo vence em 3 dias')).toBeInTheDocument();
    expect(
      central.getByText(
        'O Cartão Azul fecha amanhã. Compras a partir de 03/11 entram na fatura de Dezembro.',
      ),
    ).toBeInTheDocument();
    expect(central.getByRole('region', { name: 'Hoje' })).toBeInTheDocument();
    expect(central.getByRole('region', { name: 'Esta semana' })).toBeInTheDocument();
  });

  it('abre o contexto do alerta no mês da fatura e marca como lido', async () => {
    const router = await abrir();

    const central = await abrirSino();
    fireEvent.click(central.getByRole('button', { name: /Faltam R\$\s320,00 de Ana/ }));

    await screen.findByRole('heading', { level: 1, name: 'A receber' });
    expect(router.state.location.search).toBe(`?pessoa=${String(ids.ana)}`);
    expect(useApp.getState().competencia).toBe('2026-10');
    expect(await sino('Alertas, 2 novos')).toBeInTheDocument();
    expect((await repos.preferencias.ler()).alertasLidos).toEqual([
      `reembolso:${String(ids.roxo)}:2026-10:${String(ids.ana)}`,
    ]);
  });

  it('leva a fatura para Faturas com o cartão escolhido', async () => {
    const router = await abrir();

    const central = await abrirSino();
    fireEvent.click(central.getByRole('button', { name: /vence em 3 dias/ }));

    await screen.findByRole('heading', { level: 1, name: 'Faturas' });
    expect(router.state.location.search).toBe(`?cartao=${String(ids.roxo)}`);
  });

  it('marca tudo como lido', async () => {
    await abrir();

    const central = await abrirSino();
    fireEvent.click(central.getByRole('button', { name: 'Marcar tudo como lido' }));

    expect(await sino('Alertas')).toBeInTheDocument();
    expect(central.queryByText('3 novas')).not.toBeInTheDocument();
    await waitFor(async () => {
      expect((await repos.preferencias.ler()).alertasLidos).toHaveLength(3);
    });
  });

  it('copia a cobrança pelo botão Cobrar, separado da linha', async () => {
    const router = await abrir();

    const central = await abrirSino();
    fireEvent.click(central.getByRole('button', { name: 'Cobrar' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Oi, Ana!'));
    });
    expect(router.state.location.pathname).toBe('/');
    expect(await sino('Alertas, 2 novos')).toBeInTheDocument();
  });

  it('deixa de fora os tipos desligados e mostra o vazio sem alertas', async () => {
    await repos.preferencias.gravar({
      alertasDesligados: ['reembolso', 'vencimento', 'fechamento'],
    });
    await abrir();

    const central = await abrirSino();
    expect(central.getByText('Nenhum alerta por enquanto.')).toBeInTheDocument();
  });

  it('leva a Escolher alertas em Configurações', async () => {
    const router = await abrir();

    const central = await abrirSino();
    fireEvent.click(central.getByRole('button', { name: 'Escolher alertas' }));

    await screen.findByRole('heading', { level: 1, name: 'Configurações' });
    expect(router.state.location.search).toBe('?secao=alertas');
  });
});

describe('Notificação do Windows', () => {
  it('avisa os alertas novos uma vez e guarda quais já foram avisados', async () => {
    await repos.preferencias.gravar({ alertasDesligados: ['fechamento', 'vencimento'] });
    await abrir();

    await waitFor(async () => {
      expect((await repos.preferencias.ler()).alertasNotificados).toEqual([
        `reembolso:${String(ids.roxo)}:2026-10:${String(ids.ana)}`,
      ]);
    });
    const avisos = vi.mocked(notificarNoWindows).mock.calls.at(-1)?.[0];
    expect(avisos?.map((a) => a.texto)).toEqual([
      expect.stringMatching(/^Faltam R\$\s320,00 de Ana/) as string,
    ]);
  });

  it('não avisa com o switch do Windows desligado', async () => {
    vi.mocked(notificarNoWindows).mockClear();
    await repos.preferencias.gravar({ notificarNoWindows: false });
    await abrir();
    await sino('Alertas, 3 novos');

    expect(vi.mocked(notificarNoWindows)).not.toHaveBeenCalled();
  });
});
