import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { CONFIGURACOES, PAGINAS } from './paginas';
import { useApp } from './store';

export function useAtalhosGlobais() {
  const navigate = useNavigate();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, select, [contenteditable]')
      ) {
        return;
      }

      if (e.altKey && !e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        void navigate(-1);
        return;
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;

      const app = useApp.getState();
      const pagina = /^[1-8]$/.test(e.key) ? PAGINAS[Number(e.key) - 1] : undefined;
      const acoes: Record<string, (() => void) | undefined> = {
        b: app.alternarSidebar,
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
