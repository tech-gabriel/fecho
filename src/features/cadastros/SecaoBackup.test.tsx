import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import type { ServicoDeBackup } from '@/data/backup';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';

let repos: Repositorios;
let backup: {
  [K in keyof ServicoDeBackup]: ServicoDeBackup[K] extends (...a: never[]) => unknown
    ? ReturnType<typeof vi.fn>
    : boolean;
};

function servicoFalso() {
  return {
    disponivel: true,
    caminhos: vi.fn().mockResolvedValue({
      banco: 'C:\\Users\\voce\\AppData\\Roaming\\fecho\\fecho.db',
      backups: 'C:\\Users\\voce\\Documents\\Fechô\\Backups',
    }),
    exportar: vi.fn().mockResolvedValue('D:\\pendrive\\fecho.db'),
    automatico: vi.fn().mockResolvedValue('C:\\backup.db'),
    escolherBackup: vi.fn().mockResolvedValue('D:\\pendrive\\fecho.db'),
    inspecionar: vi.fn().mockResolvedValue({
      compras: 3,
      versao: 5,
      modificadoEm: new Date(2026, 9, 20, 8, 12).getTime(),
    }),
    restaurar: vi.fn().mockResolvedValue(undefined),
    escolherPasta: vi.fn().mockResolvedValue('D:\\OneDrive'),
  };
}

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/configuracoes'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return screen.findByRole('region', { name: 'Dados e backup' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 14, 0));
  backup = servicoFalso();
  repos = { ...criarRepositoriosEmMemoria(), backup: backup as unknown as ServicoDeBackup };
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Dados e backup', () => {
  it('no navegador avisa que só funciona no app instalado', async () => {
    repos = criarRepositoriosEmMemoria();
    const secao = await abrir();

    expect(secao).toHaveTextContent('Backup e restauração funcionam no app instalado.');
  });

  it('não exporta planilha de mês sem compras', async () => {
    const secao = await abrir();
    fireEvent.click(within(secao).getByRole('button', { name: 'Exportar planilha do mês' }));

    expect(await screen.findByText(/^Nada lançado em \w+ para exportar\.$/)).toBeInTheDocument();
  });

  it('mostra os caminhos e liga e desliga o automático', async () => {
    const secao = await abrir();

    expect(
      await within(secao).findByText(/AppData\\Roaming\\fecho\\fecho\.db/),
    ).toBeInTheDocument();
    expect(await within(secao).findByText('Último backup: hoje às 14:00')).toBeInTheDocument();
    const chave = await within(secao).findByRole('switch', { name: 'Backup automático' });
    expect(chave).toBeChecked();

    fireEvent.click(chave);

    expect(await screen.findByText('Backup automático desligado')).toBeInTheDocument();
    expect((await repos.preferencias.ler()).backupAutomatico).toBe(false);
  });

  it('exporta para o destino escolhido', async () => {
    const secao = await abrir();

    fireEvent.click(within(secao).getByRole('button', { name: /Exportar backup/ }));

    expect(await screen.findByText(/Backup salvo em D:\\pendrive\\fecho\.db/)).toBeInTheDocument();
    expect(backup.exportar).toHaveBeenCalledWith('fecho-2026-10-20-140000.db');
  });

  it('restaura depois de confirmar', async () => {
    const secao = await abrir();

    fireEvent.click(within(secao).getByRole('button', { name: /Restaurar backup/ }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Restaurar o backup de hoje às 08:12?',
    });
    expect(dialog).toHaveTextContent('Ele tem 3 compras.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar e reiniciar' }));

    await waitFor(() => {
      expect(backup.restaurar).toHaveBeenCalledWith(
        'D:\\pendrive\\fecho.db',
        'fecho-2026-10-20-140000.db',
        undefined,
      );
    });
  });

  it('avisa quando o arquivo não é um backup', async () => {
    backup.inspecionar.mockRejectedValue(new Error('Este arquivo não é um backup do Fechô.'));
    const secao = await abrir();

    fireEvent.click(within(secao).getByRole('button', { name: /Restaurar backup/ }));

    expect(await screen.findByText('Este arquivo não é um backup do Fechô.')).toBeInTheDocument();
    expect(backup.restaurar).not.toHaveBeenCalled();
  });

  describe('cópia em outra pasta', () => {
    let criptografado: boolean;
    const definirSenhaDeBackup = vi.fn();

    beforeEach(() => {
      criptografado = false;
      definirSenhaDeBackup.mockReset().mockImplementation((senha: string | null) => {
        criptografado = senha !== null;
        return Promise.resolve();
      });
      repos = {
        ...repos,
        seguranca: {
          ...repos.seguranca,
          criptografiaDeBackupDisponivel: true,
          estado: () =>
            Promise.resolve({ pinAtivo: false, backupCriptografado: criptografado, arquivo: '' }),
          definirSenhaDeBackup,
        },
      };
    });

    it('pede a senha dos backups antes de escolher a pasta e já faz a primeira cópia', async () => {
      const secao = await abrir();

      fireEvent.click(await within(secao).findByRole('button', { name: 'Escolher pasta…' }));
      const dialog = await screen.findByRole('dialog', { name: 'Criptografar backups' });
      fireEvent.change(within(dialog).getByLabelText('Senha'), { target: { value: 'segredo123' } });
      fireEvent.change(within(dialog).getByLabelText('Repita a senha'), {
        target: { value: 'segredo123' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Criptografar' }));

      expect(await screen.findByText('A cópia vai para D:\\OneDrive')).toBeInTheDocument();
      expect(definirSenhaDeBackup).toHaveBeenCalledWith('segredo123');
      expect(backup.automatico).toHaveBeenCalledWith('fecho-2026-10-20-140000.db', 'D:\\OneDrive');
      expect((await repos.preferencias.ler()).pastaDaCopiaExterna).toBe('D:\\OneDrive');
      expect(within(secao).getByText('D:\\OneDrive')).toBeInTheDocument();
    });

    it('com criptografia ligada vai direto para a pasta, e desliga', async () => {
      criptografado = true;
      const secao = await abrir();

      fireEvent.click(await within(secao).findByRole('button', { name: 'Escolher pasta…' }));
      expect(await screen.findByText('A cópia vai para D:\\OneDrive')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(within(secao).getByRole('button', { name: 'Desligar cópia em outra pasta' }));
      await waitFor(async () => {
        expect((await repos.preferencias.ler()).pastaDaCopiaExterna).toBeNull();
      });
    });

    it('desligar a criptografia desliga também a cópia externa', async () => {
      criptografado = true;
      await repos.preferencias.gravar({ pastaDaCopiaExterna: 'D:\\OneDrive' });
      const secao = await abrir();

      const chave = await within(secao).findByRole('switch', { name: 'Criptografar backups' });
      await waitFor(() => {
        expect(chave).toBeChecked();
      });
      fireEvent.click(chave);

      expect(
        await screen.findByText(
          'Os próximos backups saem sem criptografia e a cópia em outra pasta foi desligada',
        ),
      ).toBeInTheDocument();
      expect((await repos.preferencias.ler()).pastaDaCopiaExterna).toBeNull();
    });
  });

  it('cancelar a escolha do arquivo não faz nada', async () => {
    backup.escolherBackup.mockResolvedValue(null);
    const secao = await abrir();

    fireEvent.click(within(secao).getByRole('button', { name: /Restaurar backup/ }));

    await waitFor(() => {
      expect(backup.escolherBackup).toHaveBeenCalled();
    });
    expect(backup.inspecionar).not.toHaveBeenCalled();
  });
});
