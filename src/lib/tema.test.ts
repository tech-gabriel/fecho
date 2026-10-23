import { afterEach, describe, expect, it, vi } from 'vitest';
import { aplicarTema, escolherTema, lerTema } from './tema';

function sistemaEscuro(escuro: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) => ({ matches: escuro, media: query }) as MediaQueryList,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
});

describe('tema', () => {
  it('segue o sistema quando nada foi escolhido', () => {
    expect(lerTema()).toBe('sistema');
    sistemaEscuro(true);
    aplicarTema();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('escuro escolhido vence o sistema claro, e claro vence o sistema escuro', () => {
    escolherTema('escuro');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    sistemaEscuro(true);
    escolherTema('claro');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(lerTema()).toBe('claro');
  });

  it('valor estranho no armazenamento volta para sistema', () => {
    localStorage.setItem('fecho:tema', 'roxo');
    expect(lerTema()).toBe('sistema');
  });
});
