import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

async function abrir(caminho = '/') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  return router;
}

const tela = () => screen.findByRole('dialog', { name: 'O Fechô está bloqueado' });
const digitar = async (pin: string) => {
  fireEvent.change(within(await tela()).getByLabelText('PIN'), { target: { value: pin } });
};

beforeEach(() => {
  localStorage.clear();
  useApp.setState({
    competencia: '2026-10',
    pinAtivo: false,
    bloqueio: null,
    errosDoPin: 0,
    esperarAte: null,
  });
  repos = criarRepositoriosEmMemoria();
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Tela de bloqueio', () => {
  it('abre bloqueada quando há PIN e esconde o app de quem usa leitor de tela', async () => {
    await repos.seguranca.definirPin('2580');
    await abrir();

    expect(await tela()).toHaveTextContent('Digite seu PIN de 4 dígitos');
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
    expect(await tela()).toHaveTextContent(/Bloqueado às \d\d:\d\d ao abrir o Fechô/);
  });

  it('conta as tentativas erradas e libera com o PIN certo', async () => {
    await repos.seguranca.definirPin('2580');
    await abrir();

    await digitar('1111');
    expect(await screen.findByText('PIN errado. Você ainda tem 4 tentativas.')).toBeVisible();

    await digitar('2580');
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'O Fechô está bloqueado' }),
      ).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeVisible();
  });

  it('depois de 5 erros espera 60 segundos', async () => {
    await repos.seguranca.definirPin('2580');
    await abrir();
    await tela();

    act(() => {
      useApp.setState({ errosDoPin: 0, esperarAte: Date.now() + 60_000 });
    });

    expect(await screen.findByText(/Muitas tentativas\. Tente de novo em 60s\./)).toBeVisible();
    expect(within(await tela()).getByLabelText('PIN')).toBeDisabled();
  });

  it('explica como sair quando esqueceu o PIN', async () => {
    await repos.seguranca.definirPin('2580');
    await abrir();

    fireEvent.click(within(await tela()).getByRole('button', { name: 'Esqueci meu PIN' }));

    await waitFor(async () => {
      expect(await tela()).toHaveTextContent(
        'No navegador, limpe os dados deste site para tirar o PIN.',
      );
    });
  });

  it('Ctrl+L bloqueia na hora', async () => {
    await repos.seguranca.definirPin('2580');
    await abrir();
    await digitar('2580');
    await screen.findByRole('navigation', { name: 'Principal' });

    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });

    expect(await tela()).toHaveTextContent(/pelo botão Bloquear/);
  });

  it('bloqueia sozinho depois do tempo sem uso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    await repos.preferencias.gravar({ bloquearAposMinutos: 1 });
    await repos.seguranca.definirPin('2580');
    await abrir();
    await digitar('2580');
    await screen.findByRole('navigation', { name: 'Principal' });

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(await tela()).toHaveTextContent(/depois de 1 minutos sem uso/);
  });

  it('sem PIN, Ctrl+L leva para definir um', async () => {
    const router = await abrir();
    await screen.findByRole('navigation', { name: 'Principal' });

    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });

    await waitFor(() => {
      expect(router.state.location.search).toBe('?secao=seguranca');
    });
    expect(await screen.findByText('Defina um PIN para bloquear o Fechô.')).toBeVisible();
  });
});

describe('Configurações › Segurança', () => {
  const secao = () => screen.findByRole('region', { name: 'Segurança' });

  it('liga, troca e desliga o PIN', async () => {
    await abrir('/configuracoes');

    fireEvent.click(within(await secao()).getByRole('switch', { name: 'Pedir PIN' }));
    let dialogo = await screen.findByRole('dialog', { name: 'Defina um PIN' });
    fireEvent.change(within(dialogo).getByLabelText('PIN'), { target: { value: '1234' } });
    fireEvent.change(within(dialogo).getByLabelText('Repita o PIN'), {
      target: { value: '1235' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ligar PIN' }));
    expect(await within(dialogo).findByText('Os PINs não são iguais.')).toBeVisible();
    fireEvent.change(within(dialogo).getByLabelText('Repita o PIN'), {
      target: { value: '1234' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ligar PIN' }));
    await waitFor(async () => {
      expect((await repos.seguranca.estado()).pinAtivo).toBe(true);
    });

    fireEvent.click(within(await secao()).getByRole('button', { name: 'Trocar PIN' }));
    dialogo = await screen.findByRole('dialog', { name: 'Trocar PIN' });
    fireEvent.change(within(dialogo).getByLabelText('PIN atual'), { target: { value: '1234' } });
    fireEvent.change(within(dialogo).getByLabelText('Novo PIN'), { target: { value: '9876' } });
    fireEvent.change(within(dialogo).getByLabelText('Repita o novo PIN'), {
      target: { value: '9876' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Trocar' }));
    await waitFor(async () => {
      expect(await repos.seguranca.conferirPin('9876')).toBe(true);
    });

    fireEvent.click(within(await secao()).getByRole('switch', { name: 'Pedir PIN' }));
    dialogo = await screen.findByRole('dialog', { name: 'Desligar o PIN' });
    fireEvent.change(within(dialogo).getByLabelText('PIN atual'), { target: { value: '1234' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desligar' }));
    expect(await within(dialogo).findByText('PIN errado.')).toBeVisible();
    fireEvent.change(within(dialogo).getByLabelText('PIN atual'), { target: { value: '9876' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desligar' }));
    await waitFor(async () => {
      expect((await repos.seguranca.estado()).pinAtivo).toBe(false);
    });
  });

  it('muda o tempo para bloquear', async () => {
    await repos.seguranca.definirPin('2580');
    useApp.setState({ pinAtivo: true });
    await abrir('/configuracoes');
    await digitar('2580');

    fireEvent.click(
      await within(await secao()).findByRole('combobox', { name: 'Bloquear depois de' }),
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Nunca' }));

    await waitFor(async () => {
      expect((await repos.preferencias.ler()).bloquearAposMinutos).toBeNull();
    });
  });
});
