import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type Tema = 'sistema' | 'claro' | 'escuro';

const CHAVE = 'fecho:tema';
const consulta = () => window.matchMedia('(prefers-color-scheme: dark)');

export function lerTema(): Tema {
  try {
    const tema = localStorage.getItem(CHAVE);
    return tema === 'claro' || tema === 'escuro' ? tema : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function aplicarTema(tema = lerTema()) {
  const escuro = tema === 'escuro' || (tema === 'sistema' && consulta().matches);
  document.documentElement.classList.toggle('dark', escuro);
  // a barra de título do Windows acompanha a escolha; null = seguir o sistema
  if (isTauri()) {
    void getCurrentWindow()
      .setTheme(tema === 'sistema' ? null : escuro ? 'dark' : 'light')
      .catch(() => undefined);
  }
}

export function escolherTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // sem armazenamento, a escolha vale só nesta sessão
  }
  aplicarTema(tema);
}

export function iniciarTema() {
  aplicarTema();
  consulta().addEventListener('change', () => {
    aplicarTema();
  });
}
