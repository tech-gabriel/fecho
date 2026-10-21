import { useEffect } from 'react';
import { type NavigateFunction, useNavigate } from 'react-router';
import { acionar, desfazerUltimo, emCampoDeTexto } from '@/lib/atalhos';
import { CONFIGURACOES, PAGINAS } from './paginas';
import { useApp } from './store';

export const A_RECEBER = '/receber';

export function registrarDeposito(navigate: NavigateFunction) {
  if (!acionar('outro-valor')) void navigate(A_RECEBER, { state: { registrar: true } });
}

export function useAtalhosGlobais() {
  const navigate = useNavigate();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const app = useApp.getState();
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.abrirOverlay(app.overlay === 'paleta' ? null : 'paleta');
        return;
      }
      if (emCampoDeTexto(e.target)) return;

      if (e.key === '?' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        app.abrirOverlay('atalhos');
        return;
      }
      if (e.altKey && !e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        void navigate(-1);
        return;
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;

      const pagina = /^[1-8]$/.test(e.key) ? PAGINAS[Number(e.key) - 1] : undefined;
      const acoes: Record<string, (() => void) | undefined> = {
        b: app.alternarSidebar,
        n: () => {
          app.abrirNovaCompra();
        },
        r: () => {
          registrarDeposito(navigate);
        },
        z: () => {
          desfazerUltimo();
        },
        ArrowLeft: app.voltarMes,
        ArrowRight: app.avancarMes,
        Home: app.irParaHoje,
        ',': () => void navigate(CONFIGURACOES.caminho),
      };
      const acao = pagina
        ? () => void navigate(pagina.caminho)
        : acoes[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!acao) return;

      e.preventDefault();
      acao();
    };

    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [navigate]);
}
