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
let ids: { pessoal: number; ana: number };

async function abrir(caminho = '/emprestimos') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const card = (nome: string) => screen.findByRole('region', { name: nome });
const tile = (dentro: HTMLElement, rotulo: string) =>
  within(dentro).getByText(rotulo).parentElement as HTMLElement;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10));
  useApp.setState({ competencia: '2026-11', legendaDaPagina: null });
  repos = criarRepositoriosEmMemoria();
  ids = {
    pessoal: await repos.emprestimos.tomados.criar({
      descricao: 'Empréstimo pessoal',
      valorCentavos: 490_000,
      numParcelas: 12,
      valorParcelaCentavos: 48_000,
      dia: 10,
      inicio: '2026-05',
      data: '2026-04-10',
    }),
    ana: await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true }),
  };
  for (let numero = 1; numero <= 6; numero++) {
    await repos.emprestimos.marcarPaga({
      emprestimoId: ids.pessoal,
      numero,
      pagoEm: '2026-10-10',
    });
  }
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Meus empréstimos', () => {
  it('mostra o card com o que falta, os juros e a parcela atrasada', async () => {
    await abrir();

    const pessoal = await card('Empréstimo pessoal');
    expect(pessoal).toHaveTextContent(
      'Pego em 10/04/2026 · 12 parcelas de R$ 480,00 · debitadas no dia 10',
    );
    expect(pessoal).toHaveTextContent('7ª venceu 10/11');
    expect(tile(pessoal, 'Ainda falta pagar')).toHaveTextContent(/R\$\s2\.880,00/);
    expect(tile(pessoal, 'Juros no total')).toHaveTextContent(
      /R\$\s860,00Vai pagar R\$\s5\.760,00 ao todo/,
    );
    expect(within(pessoal).getByRole('img')).toHaveAccessibleName('6 de 12 parcelas pagas');
    expect(within(pessoal).getByRole('row', { name: /^7\/12/ })).toHaveTextContent('Atrasada');
    expect(screen.getByRole('region', { name: 'Total que você deve' })).toHaveTextContent(
      /R\$\s2\.880,00/,
    );
  });

  it('marca a parcela como paga e desfaz', async () => {
    await abrir();

    const pessoal = await card('Empréstimo pessoal');
    fireEvent.click(within(pessoal).getByRole('button', { name: 'Marcar a parcela 7 como paga' }));

    await waitFor(() => {
      expect(tile(pessoal, 'Ainda falta pagar')).toHaveTextContent(/R\$\s2\.400,00/);
    });
    expect(within(pessoal).getByRole('row', { name: /^7\/12/ })).toHaveTextContent('Paga em 12/11');
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(tile(pessoal, 'Ainda falta pagar')).toHaveTextContent(/R\$\s2\.880,00/);
    });
  });

  it('registra um empréstimo que você pegou, com a prévia dos juros', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Novo empréstimo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo empréstimo' });
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Celular' } });
    fireEvent.change(within(dialog).getByLabelText('Quanto você recebeu'), {
      target: { value: '1.000,00' },
    });
    fireEvent.change(within(dialog).getByLabelText('Parcelas'), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Valor da parcela'), {
      target: { value: '120' },
    });

    expect(within(dialog).getByRole('status')).toHaveTextContent(
      /Vai pagar R\$\s1\.200,00 ao todo · juros R\$\s200,00/,
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const celular = await card('Celular');
    expect(tile(celular, 'Você pegou')).toHaveTextContent(/R\$\s1\.000,00/);
    expect(await repos.emprestimos.tomados.listar()).toHaveLength(2);
  });

  it('registra um empréstimo para alguém e mostra em Você emprestou', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Novo empréstimo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo empréstimo' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Emprestei' }));
    fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '300' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const emprestou = await screen.findByRole('region', { name: 'Você emprestou' });
    await waitFor(() => {
      expect(emprestou).toHaveTextContent(/Ana · R\$\s300,00/);
    });
    expect((await repos.emprestimos.concedidos.listar())[0]).toMatchObject({
      terceiroId: ids.ana,
      valorCentavos: 30_000,
      prazo: '2026-11-12',
    });
  });

  it('recusa empréstimo sem valor', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Novo empréstimo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo empréstimo' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findAllByText('Digite um valor maior que zero')).toHaveLength(2);
    expect(await repos.emprestimos.tomados.listar()).toHaveLength(1);
  });

  it('exclui pelo menu e desfaz', async () => {
    await abrir();

    fireEvent.pointerDown(
      within(await card('Empréstimo pessoal')).getByRole('button', {
        name: 'Ações do Empréstimo pessoal',
      }),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));

    expect(await screen.findByText('Nenhum empréstimo por aqui.')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    expect(await card('Empréstimo pessoal')).toBeInTheDocument();
  });
});

describe('Empréstimo concedido em A receber', () => {
  it('entra no saldo da pessoa e o depósito abate o empréstimo escolhido', async () => {
    const emprestimoId = await repos.emprestimos.concedidos.criar({
      terceiroId: ids.ana,
      descricao: 'Empréstimo',
      valorCentavos: 80_000,
      data: '2026-08-15',
      prazo: '2026-11-15',
    });
    await abrir('/receber');

    const ana = await screen.findByRole('option', { name: /Ana/ });
    expect(ana).toHaveTextContent(/R\$\s800,00/);
    expect(
      screen.getByText('Ana combinou devolver R$ 800,00 do empréstimo até 15/11.'),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Outro valor' }));
    fireEvent.change(screen.getByLabelText('Quanto Ana depositou?'), {
      target: { value: '300,00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar depósito' }));

    await waitFor(() => {
      expect(ana).toHaveTextContent(/R\$\s500,00/);
    });
    expect((await repos.receber.movimentos())[0]?.abatimentos).toEqual([
      { emprestimoId, valor: 30_000 },
    ]);
  });
});
