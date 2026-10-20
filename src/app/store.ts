import { create } from 'zustand';
import { competenciaDe, somarMeses, type Competencia, type DataLocal } from '@/domain/competencia';

const CHAVE_SIDEBAR = 'fecho:sidebar-recolhida';

export function hojeLocal(agora = new Date()): DataLocal {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

function lerSidebarRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_SIDEBAR) === '1';
  } catch {
    return false;
  }
}

function gravarSidebarRecolhida(recolhida: boolean) {
  try {
    localStorage.setItem(CHAVE_SIDEBAR, recolhida ? '1' : '0');
  } catch {
    // sem armazenamento, a preferência vale só nesta sessão
  }
}

interface EstadoApp {
  competencia: Competencia;
  sidebarRecolhida: boolean;
  voltarMes: () => void;
  avancarMes: () => void;
  irParaHoje: () => void;
  alternarSidebar: () => void;
}

export const useApp = create<EstadoApp>()((set) => ({
  competencia: competenciaDe(hojeLocal()),
  sidebarRecolhida: lerSidebarRecolhida(),
  voltarMes: () => {
    set((s) => ({ competencia: somarMeses(s.competencia, -1) }));
  },
  avancarMes: () => {
    set((s) => ({ competencia: somarMeses(s.competencia, 1) }));
  },
  irParaHoje: () => {
    set({ competencia: competenciaDe(hojeLocal()) });
  },
  alternarSidebar: () => {
    set((s) => {
      gravarSidebarRecolhida(!s.sidebarRecolhida);
      return { sidebarRecolhida: !s.sidebarRecolhida };
    });
  },
}));
