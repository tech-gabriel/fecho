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
let ids: { roxo: number; ana: number };

async function abrir(caminho = '/assinaturas') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const lista = () => screen.findByRole('region', { name: 'Assinaturas' });
const linha = async (nome: string) =>
  within(await lista()).getByRole('row', { name: new RegExp(nome) });

const nova = (extra: Partial<Parameters<Repositorios['assinaturas']['criar']>[0]> = {}) => ({
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
  ...extra,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', legendaDaPagina: null });
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
  await repos.receitas.criar({
    descricao: 'Salário',
    valorCentavos: 720_000,
    competencia: '2026-01',
    competenciaFim: null,
    recorrente: true,
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Assinaturas', () => {
  it('mostra os totais, a próxima cobrança e quem divide', async () => {
    await repos.assinaturas.criar(nova());
    await repos.assinaturas.criar(
      nova({ nome: 'Streaming', valorCentavos: 5_590, dia: 5, rateios: [] }),
    );
    await abrir();

    const kpi = (rotulo: string) => screen.getByText(rotulo).parentElement as HTMLElement;
    await screen.findByText('Por mês');
    expect(kpi('Por mês')).toHaveTextContent(/R\$\s85,30.*2 ativas · 1,2% da renda/);
    expect(kpi('Por ano')).toHaveTextContent(/R\$\s1\.023,60/);
    expect(kpi('Próxima cobrança')).toHaveTextContent(/25\/10.*Nuvem 2 TB · R\$\s29,40/);
    expect(await linha('Nuvem 2 TB')).toHaveTextContent('Ana paga metade');
    expect(await linha('Streaming')).toHaveTextContent('05/11');
  });

  it('cria uma assinatura e já lança a cobrança deste mês', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Nova assinatura' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Academia' } });
    fireEvent.change(within(dialog).getByLabelText('Valor por mês'), {
      target: { value: '99,90' },
    });
    fireEvent.change(within(dialog).getByLabelText('Cobra dia'), { target: { value: '28' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await linha('Academia')).toHaveTextContent(/28\/10.*R\$\s99,90/);
    const [academia] = await repos.assinaturas.listar();
    expect(academia).toMatchObject({ valorCentavos: 9_990, dia: 28, inicio: '2026-10' });
    await waitFor(async () => {
      expect(await repos.assinaturas.geradas()).toEqual([`${String(academia?.id)}:2026-10`]);
    });
  });

  it('com o dia já passado, começa no mês seguinte', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Nova assinatura' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Jornal' } });
    fireEvent.change(within(dialog).getByLabelText('Valor por mês'), {
      target: { value: '10' },
    });
    fireEvent.change(within(dialog).getByLabelText('Cobra dia'), { target: { value: '5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await linha('Jornal')).toHaveTextContent('05/11');
    expect((await repos.assinaturas.listar())[0]?.inicio).toBe('2026-11');
    expect(await repos.assinaturas.geradas()).toEqual([]);
  });

  it('recusa nome vazio e dia fora do mês', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Nova assinatura' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Cobra dia'), { target: { value: '32' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Digite um nome')).toBeInTheDocument();
    expect(within(dialog).getByText('Digite um dia de 1 a 31')).toBeInTheDocument();
    expect(await repos.assinaturas.listar()).toEqual([]);
  });

  it('pausa pelo switch e desfaz', async () => {
    const id = await repos.assinaturas.criar(nova());
    await abrir();

    fireEvent.click(within(await linha('Nuvem 2 TB')).getByRole('switch'));

    expect(await linha('Nuvem 2 TB')).toHaveTextContent('Pausada');
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(async () => {
      expect((await repos.assinaturas.listar()).find((a) => a.id === id)?.ativa).toBe(true);
    });
  });

  it('reativar não cobra os meses em que ficou pausada', async () => {
    const id = await repos.assinaturas.criar(nova({ ativa: false, inicio: '2026-06' }));
    await abrir();

    fireEvent.click(within(await linha('Nuvem 2 TB')).getByRole('switch'));

    await waitFor(async () => {
      expect((await repos.assinaturas.listar()).find((a) => a.id === id)).toMatchObject({
        ativa: true,
        inicio: '2026-10',
      });
    });
    expect(screen.queryByText('Cobranças que ficaram para trás')).not.toBeInTheDocument();
  });

  it('edita pelo Sheet e exclui com desfazer', async () => {
    const id = await repos.assinaturas.criar(nova());
    await abrir();

    fireEvent.click(within(await linha('Nuvem 2 TB')).getByRole('button', { name: 'Nuvem 2 TB' }));
    const sheet = await screen.findByRole('dialog', { name: 'Editar assinatura' });
    fireEvent.change(within(sheet).getByLabelText('Valor por mês'), {
      target: { value: '34,90' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }));

    expect(await linha('Nuvem 2 TB')).toHaveTextContent(/R\$\s34,90/);

    fireEvent.click(within(await linha('Nuvem 2 TB')).getByRole('button', { name: 'Nuvem 2 TB' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Editar assinatura' })).getByRole('button', {
        name: 'Excluir',
      }),
    );
    expect(await screen.findByText('Nenhuma assinatura ainda.')).toBeInTheDocument();
    const avisoDeExclusao = (await screen.findByText('Nuvem 2 TB excluída')).closest('li');
    fireEvent.click(
      within(avisoDeExclusao as HTMLElement).getByRole('button', { name: 'Desfazer' }),
    );
    await waitFor(async () => {
      expect((await repos.assinaturas.listar()).map((a) => a.id)).toEqual([id]);
    });
  });
});

describe('Cobranças que ficaram para trás', () => {
  it('pergunta antes de gerar os meses passados e gera ao confirmar', async () => {
    const id = await repos.assinaturas.criar(nova({ inicio: '2026-08' }));
    await abrir('/');

    const dialog = await screen.findByRole('dialog', { name: 'Cobranças que ficaram para trás' });
    expect(within(dialog).getByRole('region', { name: 'Agosto 2026' })).toHaveTextContent(
      /Nuvem 2 TB.*Cartão Roxo.*R\$\s29,40/,
    );
    expect(within(dialog).getByRole('region', { name: 'Setembro 2026' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await repos.assinaturas.geradas()).toEqual([`${String(id)}:2026-10`]);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Gerar 2 cobranças' }));

    await waitFor(async () => {
      expect((await repos.assinaturas.geradas()).sort()).toEqual([
        `${String(id)}:2026-08`,
        `${String(id)}:2026-09`,
        `${String(id)}:2026-10`,
      ]);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Agora não" fecha sem gerar o passado', async () => {
    const id = await repos.assinaturas.criar(nova({ inicio: '2026-09' }));
    await abrir('/');

    const dialog = await screen.findByRole('dialog', { name: 'Cobranças que ficaram para trás' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agora não' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await repos.assinaturas.geradas()).toEqual([`${String(id)}:2026-10`]);
  });

  it('avisa quando uma cobrança não pode ser gerada', async () => {
    await repos.assinaturas.criar(nova());
    await repos.cartoes.excluir(ids.roxo);
    await abrir('/');

    expect(
      await screen.findByText('Não foi possível gerar a cobrança de Nuvem 2 TB.'),
    ).toBeInTheDocument();
  });
});
