import { create } from 'zustand';
import type { DadosNovaCompra } from '@/domain/compras';
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
  novaCompraAberta: boolean;
  novaCompraPreenchida: DadosNovaCompra | null;
  compraEmEdicao: number | null;
  versaoDosDados: number;
  legendaDaPagina: string | null;
  voltarMes: () => void;
  avancarMes: () => void;
  irParaHoje: () => void;
  alternarSidebar: () => void;
  abrirNovaCompra: (preenchida?: DadosNovaCompra) => void;
  editarCompra: (id: number) => void;
  fecharEdicao: () => void;
  fecharNovaCompra: () => void;
  dadosMudaram: () => void;
  definirLegenda: (legenda: string | null) => void;
}

export const useApp = create<EstadoApp>()((set) => ({
  competencia: competenciaDe(hojeLocal()),
  sidebarRecolhida: lerSidebarRecolhida(),
  novaCompraAberta: false,
  novaCompraPreenchida: null,
  compraEmEdicao: null,
  versaoDosDados: 0,
  legendaDaPagina: null,
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
  abrirNovaCompra: (preenchida) => {
    set({ novaCompraAberta: true, novaCompraPreenchida: preenchida ?? null });
  },
  fecharNovaCompra: () => {
    set({ novaCompraAberta: false });
  },
  editarCompra: (compraEmEdicao) => {
    set({ compraEmEdicao });
  },
  fecharEdicao: () => {
    set({ compraEmEdicao: null });
  },
  dadosMudaram: () => {
    set((s) => ({ versaoDosDados: s.versaoDosDados + 1 }));
  },
  definirLegenda: (legendaDaPagina) => {
    set({ legendaDaPagina });
  },
}));
