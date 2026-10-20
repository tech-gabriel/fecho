import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
let ids: { roxo: number; ana: number };

const CSV = [
  'Data;Descrição;Valor;Cartão;Parc.;Quem',
  '12/10/2026;Mercado;48,73;Roxo;;',
  '02/10/2026;Tênis;108,25;Roxo;1/6;Ana',
  '02/11/2026;Tênis;108,25;Roxo;2/6;Ana',
  '15/10/2026;Livro;;Nubank;;',
  '05/10/2026;Jantar;80,00;Nubank;;Ana e eu',
  '19/10/2026;Café;10,00;Roxo;;',
].join('\n');

const arquivo = (conteudo: string, nome = 'financas.csv') =>
  new File([conteudo], nome, { type: 'text/csv' });

async function abrir() {
  const router = createMemoryRouter(rotas, {
    initialEntries: ['/lancamentos', '/importar'],
    initialIndex: 1,
  });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Traga sua planilha' });
  return router;
}

const continuar = () => screen.getByRole('button', { name: 'Continuar' });

function enviar(conteudo: string, nome?: string) {
  fireEvent.change(screen.getByLabelText('Arquivo da planilha'), {
    target: { files: [arquivo(conteudo, nome)] },
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ planilhaArrastada: null });
  repos = criarRepositoriosEmMemoria();
  ids = {
    roxo: await repos.cartoes.criar({
      nome: 'Roxo',
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
    descricao: 'Café',
    categoriaId: null,
    valorTotal: 1_000,
    numParcelas: 1,
    dataCompra: '2026-10-19',
    recorrente: false,
    rateios: [],
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Importação de planilha', () => {
  it('importa ponta a ponta resolvendo os pontos da prévia, e desfaz', async () => {
    await abrir();

    expect(continuar()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Escolha um arquivo para continuar')).toBeInTheDocument();
    enviar(CSV);
    expect(await screen.findByText('Arquivo lido')).toBeInTheDocument();
    expect(screen.getByText(/1 aba · 7 linhas/)).toBeInTheDocument();
    fireEvent.click(continuar());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Confira as abas e colunas' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tudo certo nesta aba')).toBeInTheDocument();
    fireEvent.click(continuar());

    expect(
      await screen.findByRole('heading', { name: '3 pontos para revisar' }),
    ).toBeInTheDocument();
    expect(continuar()).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByText(/Importar mesmo assim: 19\/10\/2026 · Café · Roxo/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '39,90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar valor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dividir igualmente' }));
    fireEvent.change(screen.getByLabelText('Fecha dia'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Vence dia'), { target: { value: '17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartão' }));

    expect(await screen.findByRole('heading', { name: 'Tudo revisado' })).toBeInTheDocument();
    fireEvent.click(continuar());

    fireEvent.click(await screen.findByRole('button', { name: 'Importar 4 compras' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tudo pronto!' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('4 compras importadas')).toBeInTheDocument();

    const nubank = (await repos.cartoes.listar()).find((c) => c.nome === 'Nubank');
    expect(nubank).toMatchObject({ diaFechamento: 10, diaVencimento: 17 });
    const outubro = await repos.compras.parcelasDaCompetencia('2026-10');
    expect(outubro.find((p) => p.descricao === 'Tênis')).toMatchObject({
      numero: 1,
      numParcelas: 6,
      valorCentavos: 10_825,
      rateios: [{ terceiroId: ids.ana, percentual: 100 }],
    });
    expect(outubro.find((p) => p.descricao === 'Jantar')?.rateios).toEqual([
      { terceiroId: ids.ana, percentual: 50 },
      { terceiroId: null, percentual: 50 },
    ]);
    expect((await repos.compras.listar()).filter((c) => c.descricao === 'Café')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect(await repos.compras.listar()).toHaveLength(1);
    });
    expect((await repos.cartoes.listar()).map((c) => c.nome)).toEqual(['Roxo']);
  });

  it('pede a coluna que falta e aceita a escolha manual', async () => {
    await abrir();

    enviar(['Data;Descrição;Quanto', '12/10/2026;Mercado;48,73'].join('\n'), 'mercado.csv');
    await screen.findByText('Arquivo lido');
    fireEvent.click(continuar());

    expect(await screen.findByText('Falta escolher: Valor')).toBeInTheDocument();
    expect(continuar()).toHaveAttribute('aria-disabled', 'true');

    const destino = screen.getByRole('combobox', { name: 'Destino da Coluna “Quanto”' });
    fireEvent.keyDown(destino, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: 'Valor' }));

    expect(await screen.findByText('Tudo certo nesta aba')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Sem coluna de cartão/ })).toHaveTextContent(
      'Novo cartão “mercado”',
    );
  });

  it('recusa arquivo que não é planilha', async () => {
    await abrir();

    enviar('oi', 'notas.txt');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esse arquivo não é .xlsx nem .csv.',
    );
  });

  it('Cancelar volta para a tela anterior', async () => {
    const router = await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lancamentos');
    });
  });
});
