import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';
import { RepositoriosProvider } from './repositorios';
import { rotas } from './router';

let repos: Repositorios;
const automatico = vi.fn<(nome: string) => Promise<string>>();

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/faturas'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Faturas' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 14, 0));
  automatico.mockReset().mockResolvedValue('C:\\backup.db');
  const base = criarRepositoriosEmMemoria();
  repos = {
    ...base,
    backup: { ...base.backup, disponivel: true, automatico },
  };
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('backup automático', () => {
  it('faz o backup ao abrir quando está pendente e guarda a data', async () => {
    await abrir();

    await waitFor(async () => {
      expect((await repos.preferencias.ler()).ultimoBackup).toBe(
        new Date(2026, 9, 20, 14, 0).toISOString(),
      );
    });
    expect(automatico).toHaveBeenCalledTimes(1);
    expect(automatico).toHaveBeenCalledWith('fecho-2026-10-20-140000.db');
  });

  it('não faz nada se foi desligado ou se o último é recente', async () => {
    await repos.preferencias.gravar({ backupAutomatico: false });
    await abrir();
    await repos.preferencias.gravar({
      backupAutomatico: true,
      ultimoBackup: new Date(2026, 9, 20, 9).toISOString(),
    });

    expect(automatico).not.toHaveBeenCalled();
  });

  it('avisa quando falha', async () => {
    automatico.mockRejectedValue(new Error('disco cheio'));
    await abrir();

    expect(await screen.findByText('O backup automático falhou.')).toBeInTheDocument();
  });
});
