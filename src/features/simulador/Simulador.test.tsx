import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';

let repos: Repositorios;

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/simulador'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Simulador' });
}

const preencher = (rotulo: string, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
};
const resultado = () => screen.findByRole('region', { name: 'Resultado' });

const bancoCentral = vi.fn((url: string) => {
  const serie = /sgs\.(\d+)\//.exec(url)?.[1] ?? '';
  const valor = { '4389': '12.00', '1178': '12.10', '195': '0.50' }[serie];
  return Promise.resolve(Response.json([{ data: '29/10/2026', valor }]));
});

beforeEach(() => {
  repos = criarRepositoriosEmMemoria();
  bancoCentral.mockClear();
  vi.stubGlobal('fetch', bancoCentral);
});

afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
});

describe('Simulador', () => {
  it('simula com taxa fixa sem buscar nada na internet', async () => {
    await abrir();

    preencher('Aporte inicial', '1.000,00');
    preencher('Aporte por mês', '0');
    preencher('Prazo em meses', '12');
    preencher('Taxa ao ano', '12');

    const r = within(await resultado());
    expect(r.getByText('Você resgata').parentElement).toHaveTextContent(/R\$\s1\.096,00/);
    expect(r.getByText(/Imposto/).parentElement).toHaveTextContent(/R\$\s24,00/);
    expect(bancoCentral).not.toHaveBeenCalled();
  });

  it('sem taxas salvas, CDI fica desligado até atualizar', async () => {
    await abrir();

    expect(screen.getByRole('radio', { name: 'CDI' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar taxas' }));

    expect(await screen.findByText(/Taxas do Banco Central de 29\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'CDI' })).toBeEnabled();
    await waitFor(async () => {
      expect((await repos.preferencias.ler()).taxas).toMatchObject({ cdi: 12, selic: 12.1 });
    });
  });

  it('na poupança não desconta imposto', async () => {
    await repos.preferencias.gravar({
      taxas: { cdi: 12, selic: 12.1, poupancaMensal: 0.5, data: '2026-10-29' },
    });
    await abrir();

    fireEvent.click(await screen.findByRole('radio', { name: 'Poupança' }));
    preencher('Aporte inicial', '1.000,00');
    preencher('Prazo em meses', '12');

    const r = within(await resultado());
    expect(r.getByText(/Imposto/).parentElement).toHaveTextContent(/Isento/);
    expect(r.getByText('Você resgata').parentElement).toHaveTextContent(/R\$\s1\.061,68/);
  });

  it('sem conexão avisa e continua com as taxas guardadas', async () => {
    await repos.preferencias.gravar({
      taxas: { cdi: 12, selic: 12.1, poupancaMensal: 0.5, data: '2026-09-01' },
    });
    bancoCentral.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar taxas' }));

    expect(
      await screen.findByText('Sem conexão com o Banco Central. Usando as taxas de 01/09/2026.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'CDI' })).toBeEnabled();
  });
});
