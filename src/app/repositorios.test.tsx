import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import { RepositoriosProvider, useRepositorios } from './repositorios';

function ListaCartoes() {
  const repos = useRepositorios();
  return <p>{typeof repos.cartoes.listar}</p>;
}

describe('RepositoriosProvider', () => {
  it('entrega os repositórios aos filhos', async () => {
    render(
      <RepositoriosProvider criar={async () => criarRepositoriosEmMemoria()}>
        <ListaCartoes />
      </RepositoriosProvider>,
    );

    expect(await screen.findByText('function')).toBeInTheDocument();
  });

  it('mostra o erro e tenta de novo', async () => {
    const criar = vi
      .fn<() => Promise<ReturnType<typeof criarRepositoriosEmMemoria>>>()
      .mockRejectedValueOnce(new Error('banco travado'))
      .mockResolvedValue(criarRepositoriosEmMemoria());
    render(
      <RepositoriosProvider criar={criar}>
        <ListaCartoes />
      </RepositoriosProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('function')).toBeInTheDocument();
    expect(criar).toHaveBeenCalledTimes(2);
  });

  it('exige o provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<ListaCartoes />)).toThrow('fora do RepositoriosProvider');
  });
});
