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
let viagem: number;

async function abrir() {
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={createMemoryRouter(rotas, { initialEntries: ['/economias'] })} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { name: 'Quanto você guardou' });
}

const meta = () => screen.getByRole('region', { name: /^Meta de/ });
const objetivos = () => screen.getByRole('region', { name: 'Objetivos' });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  useApp.setState({ competencia: '2026-10', legendaDaPagina: null });
  repos = criarRepositoriosEmMemoria();
  await repos.receitas.criar({
    descricao: 'Salário',
    valorCentavos: 300_000,
    competencia: '2026-01',
    competenciaFim: null,
    recorrente: true,
  });
  await repos.economias.metas.definir({ valorCentavos: 80_000, inicio: '2026-01' });
  viagem = await repos.economias.objetivos.criar({
    nome: 'Viagem',
    alvoCentavos: 800_000,
    prazo: '2027-07',
  });
  await repos.economias.movimentos.criar({
    data: '2026-09-05',
    valorCentavos: 80_000,
    objetivoId: viagem,
  });
  await repos.economias.movimentos.criar({
    data: '2026-10-05',
    valorCentavos: 50_000,
    objetivoId: null,
  });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Economias', () => {
  it('mostra a meta do mês, o ritmo e o total guardado', async () => {
    await abrir();

    expect(meta()).toHaveTextContent(/R\$\s500,00de R\$\s800,00/);
    expect(meta()).toHaveTextContent(
      /Faltam R\$\s300,00\. No ritmo de Outubro, sobram R\$\s2\.500,00 no fim do mês, então dá para bater a meta\./,
    );
    expect(meta()).toHaveTextContent('Faltam 11 dias');
    expect(screen.getByRole('region', { name: 'Total guardado' })).toHaveTextContent(
      /R\$\s1\.300,00Em 1 objetivo · 1 de 10 meses com a meta batida/,
    );
    expect(screen.getByText('Meta de R$ 800,00 por mês')).toBeVisible();
  });

  it('avisa quando o ritmo do mês não alcança a meta', async () => {
    await repos.economias.metas.definir({ valorCentavos: 400_000, inicio: '2026-10' });
    await abrir();

    expect(meta()).toHaveTextContent(/faltariam R\$\s1\.000,00 para a meta\./);
  });

  it('mostra no gráfico quem bateu a meta', async () => {
    await abrir();

    const tabela = screen.getByRole('table', { name: 'Quanto você guardou nos últimos 12 meses' });
    expect(within(tabela).getByRole('row', { name: /Setembro 2026/ })).toHaveTextContent(
      /R\$\s800,00R\$\s800,00sim/,
    );
    expect(within(tabela).getByRole('row', { name: /Outubro 2026/ })).toHaveTextContent('não');
    expect(within(tabela).getByRole('row', { name: /Dezembro 2025/ })).toHaveTextContent(
      'sem meta',
    );
  });

  it('registra o que guardou para um objetivo e o que tirou', async () => {
    await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar economia' }));
    let dialog = await screen.findByRole('dialog', { name: 'Registrar economia' });
    fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '300' } });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Objetivo' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Viagem' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(meta()).toHaveTextContent(/R\$\s800,00de R\$\s800,00/);
    });
    expect(meta()).toHaveTextContent('Meta batida!');
    expect(objetivos()).toHaveTextContent('13%');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar economia' }));
    dialog = await screen.findByRole('dialog', { name: 'Registrar economia' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Tirei' }));
    fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '100' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const registros = await screen.findByRole('region', { name: 'Registros de Outubro' });
    await waitFor(() => {
      expect(within(registros).getAllByRole('listitem')).toHaveLength(3);
    });
    expect(registros).toHaveTextContent(/Tirei · Sem objetivo−R\$\s100,00/);
  });

  it('muda a meta só a partir do mês escolhido', async () => {
    await abrir();

    fireEvent.click(within(meta()).getByRole('button', { name: 'Mudar meta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mudar meta' });
    fireEvent.change(within(dialog).getByLabelText('Guardar por mês'), {
      target: { value: '1.000,00' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(meta()).toHaveTextContent(/de R\$\s1\.000,00/);
    });
    expect(await repos.economias.metas.listar()).toEqual([
      { valorCentavos: 80_000, inicio: '2026-01' },
      { valorCentavos: 100_000, inicio: '2026-10' },
    ]);
  });

  it('sem meta, pede para definir uma', async () => {
    repos = criarRepositoriosEmMemoria();
    await abrir();

    expect(within(meta()).getByRole('button', { name: 'Definir meta' })).toBeVisible();
    expect(screen.getByText('Sem meta definida')).toBeVisible();
    expect(
      screen.getByText('Crie um objetivo para ver quanto falta para chegar lá.'),
    ).toBeVisible();
  });

  it('cria, edita e exclui um objetivo', async () => {
    await abrir();

    fireEvent.click(within(objetivos()).getByRole('button', { name: 'Novo objetivo' }));
    let dialog = await screen.findByRole('dialog', { name: 'Novo objetivo' });
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Notebook' } });
    fireEvent.change(within(dialog).getByLabelText('Quanto quer juntar'), {
      target: { value: '5.000' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(objetivos()).toHaveTextContent(/NotebookSem prazo · faltam R\$\s5\.000,00|Notebook0%/);
    });

    fireEvent.pointerDown(
      within(objetivos()).getByRole('button', { name: 'Ações do objetivo Notebook' }),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    dialog = await screen.findByRole('dialog', { name: 'Editar objetivo' });
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Notebook novo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(objetivos()).toHaveTextContent('Notebook novo');
    });

    fireEvent.pointerDown(
      within(objetivos()).getByRole('button', { name: 'Ações do objetivo Notebook novo' }),
      { button: 0, ctrlKey: false, pointerType: 'mouse' },
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    await waitFor(() => {
      expect(objetivos()).not.toHaveTextContent('Notebook');
    });
  });

  it('exclui um registro e desfaz', async () => {
    await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir o registro de 05/10' }));
    await waitFor(() => {
      expect(screen.getByText('Nada registrado em Outubro.')).toBeVisible();
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(meta()).toHaveTextContent(/R\$\s500,00de/);
    });
  });
});
