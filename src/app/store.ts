import { create } from 'zustand';
import type { DadosNovaCompra } from '@/domain/compras';
import type { PlanilhaLida } from '@/features/importacao/lerPlanilha';
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

export type MotivoDoBloqueio = 'inicio' | 'atalho' | 'inatividade';

interface EstadoApp {
  pinAtivo: boolean;
  bloqueio: { em: Date; motivo: MotivoDoBloqueio } | null;
  errosDoPin: number;
  esperarAte: number | null;
  definirPinAtivo: (ativo: boolean) => void;
  bloquear: (motivo: MotivoDoBloqueio) => void;
  desbloquear: () => void;
  errarPin: (erros: number, esperarAte: number | null) => void;
  competencia: Competencia;
  sidebarRecolhida: boolean;
  novaCompraAberta: boolean;
  novaCompraPreenchida: DadosNovaCompra | null;
  compraEmEdicao: number | null;
  versaoDosDados: number;
  legendaDaPagina: string | null;
  planilhaArrastada: PlanilhaLida | null;
  overlay: 'paleta' | 'atalhos' | null;
  abrirOverlay: (overlay: 'paleta' | 'atalhos' | null) => void;
  voltarMes: () => void;
  avancarMes: () => void;
  irParaHoje: () => void;
  irParaCompetencia: (competencia: Competencia) => void;
  alternarSidebar: () => void;
  abrirNovaCompra: (preenchida?: DadosNovaCompra) => void;
  editarCompra: (id: number) => void;
  fecharEdicao: () => void;
  fecharNovaCompra: () => void;
  dadosMudaram: () => void;
  definirLegenda: (legenda: string | null) => void;
  receberPlanilha: (planilha: PlanilhaLida | null) => void;
}

export const useApp = create<EstadoApp>()((set) => ({
  pinAtivo: false,
  bloqueio: null,
  errosDoPin: 0,
  esperarAte: null,
  definirPinAtivo: (pinAtivo) => {
    set({ pinAtivo });
  },
  bloquear: (motivo) => {
    set((s) =>
      s.bloqueio
        ? s
        : {
            bloqueio: { em: new Date(), motivo },
            overlay: null,
            novaCompraAberta: false,
            compraEmEdicao: null,
          },
    );
  },
  desbloquear: () => {
    set({ bloqueio: null, errosDoPin: 0, esperarAte: null });
  },
  errarPin: (errosDoPin, esperarAte) => {
    set({ errosDoPin, esperarAte });
  },
  competencia: competenciaDe(hojeLocal()),
  sidebarRecolhida: lerSidebarRecolhida(),
  novaCompraAberta: false,
  novaCompraPreenchida: null,
  compraEmEdicao: null,
  versaoDosDados: 0,
  legendaDaPagina: null,
  planilhaArrastada: null,
  voltarMes: () => {
    set((s) => ({ competencia: somarMeses(s.competencia, -1) }));
  },
  avancarMes: () => {
    set((s) => ({ competencia: somarMeses(s.competencia, 1) }));
  },
  irParaCompetencia: (competencia) => {
    set({ competencia });
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
  overlay: null,
  abrirOverlay: (overlay) => {
    set({ overlay });
  },
  receberPlanilha: (planilhaArrastada) => {
    set({ planilhaArrastada });
  },
}));
