import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import { procurarAtualizacao, type Atualizacao } from './atualizacao';

vi.mock('./atualizacao', () => ({
  atualizacaoDisponivel: () => true,
  procurarAtualizacao: vi.fn(),
}));

const procurar = vi.mocked(procurarAtualizacao);
const instalar = vi.fn<Atualizacao['instalar']>();

function abrir(rota: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [rota] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(criarRepositoriosEmMemoria())}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
}

beforeEach(() => {
  instalar.mockReset().mockResolvedValue(undefined);
  procurar.mockReset().mockResolvedValue({ versao: '1.0.2', instalar });
});

afterEach(() => {
  toast.dismiss();
});

describe('atualização', () => {
  it('avisa ao abrir e instala só quando o usuário pede', async () => {
    abrir('/faturas');

    expect(await screen.findByText('Versão 1.0.2 disponível')).toBeInTheDocument();
    expect(instalar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar e reiniciar' }));
    expect(instalar).toHaveBeenCalledOnce();
  });

  it('sem internet ao abrir, não mostra nada', async () => {
    procurar.mockRejectedValue(new Error('offline'));
    abrir('/faturas');

    await screen.findByRole('heading', { level: 1, name: 'Faturas' });
    expect(screen.queryByText(/disponível|Não foi possível/)).not.toBeInTheDocument();
  });

  it('em Sobre, procura quando o usuário pede e diz quando já está na última', async () => {
    procurar.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    abrir('/configuracoes');

    fireEvent.click(await screen.findByRole('button', { name: 'Procurar atualizações' }));
    expect(await screen.findByText('Você já está na versão mais recente.')).toBeInTheDocument();
  });

  it('em Sobre, explica a falha de conexão', async () => {
    procurar.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    abrir('/configuracoes');

    fireEvent.click(await screen.findByRole('button', { name: 'Procurar atualizações' }));
    expect(
      await screen.findByText('Não foi possível procurar. Confira a internet e tente de novo.'),
    ).toBeInTheDocument();
  });
});
