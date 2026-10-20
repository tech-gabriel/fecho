import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import { RepositoriosProvider } from '../repositorios';
import { rotas } from '../router';
import { useApp } from '../store';

async function abrir(caminho = '/') {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(criarRepositoriosEmMemoria())}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const seletor = () => within(screen.getByRole('group', { name: 'Mês de referência' }));

const teclar = (key: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(window, { key, ctrlKey: true, ...extra });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  localStorage.clear();
  useApp.setState({ competencia: '2026-10', sidebarRecolhida: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('layout base', () => {
  it('abre no Dashboard com a navegação principal', async () => {
    await abrir();

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav.querySelectorAll('a')).toHaveLength(8);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('navega pela sidebar e mostra título e legenda da página', async () => {
    await abrir();

    fireEvent.click(screen.getByRole('link', { name: 'Empréstimos' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Meus empréstimos' })).toBeInTheDocument();
    expect(
      screen.getByText('O que você pegou emprestado e ainda está pagando'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Empréstimos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('troca o mês pelos botões e pelos atalhos', async () => {
    await abrir();
    expect(seletor().getByText('Outubro 2026')).toBeInTheDocument();
    expect(screen.getByText('Fecha em 11 dias')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(seletor().getByText('Novembro 2026')).toBeInTheDocument();
    expect(screen.getByText('Previsto')).toBeInTheDocument();

    teclar('ArrowLeft');
    teclar('ArrowLeft');
    expect(seletor().getByText('Setembro 2026')).toBeInTheDocument();
    expect(screen.getByText('Em aberto')).toBeInTheDocument();

    teclar('Home');
    expect(seletor().getByText('Outubro 2026')).toBeInTheDocument();
  });

  it('recolhe a sidebar com Ctrl+B e guarda a preferência', async () => {
    await abrir();

    teclar('b');

    expect(screen.queryByText('Fechô')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Faturas' })).toBeInTheDocument();
    expect(localStorage.getItem('fecho:sidebar-recolhida')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Outubro 2026, expandir a barra lateral' }));
    expect(screen.getByText('Fechô')).toBeInTheDocument();
    expect(localStorage.getItem('fecho:sidebar-recolhida')).toBe('0');
  });

  it('vai para as telas com Ctrl+1…8 e Ctrl+, e volta com Alt+←', async () => {
    const router = await abrir();

    teclar('3');
    expect(router.state.location.pathname).toBe('/lancamentos');
    teclar(',');
    expect(router.state.location.pathname).toBe('/configuracoes');
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/lancamentos');
    });
  });

  it('ignora atalhos enquanto o foco está num campo', async () => {
    await abrir();
    const campo = document.createElement('input');
    document.body.append(campo);

    fireEvent.keyDown(campo, { key: 'ArrowRight', ctrlKey: true });

    expect(seletor().getByText('Outubro 2026')).toBeInTheDocument();
    campo.remove();
  });

  it('mostra as ações ainda indisponíveis como desabilitadas', async () => {
    await abrir();

    for (const nome of [/Buscar/, /Bloquear/]) {
      expect(screen.getByRole('button', { name: nome })).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('redireciona caminhos desconhecidos para o Dashboard', async () => {
    const router = await abrir('/nao-existe');

    expect(router.state.location.pathname).toBe('/');
  });
});
