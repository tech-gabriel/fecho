import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { lerPlanilha, PlanilhaInvalida } from '@/features/importacao/lerPlanilha';
import { useApp } from '../store';

const PLANILHA = /\.(xlsx|csv)$/i;

export function Raiz() {
  const navigate = useNavigate();
  const receberPlanilha = useApp((s) => s.receberPlanilha);
  const { pathname } = useLocation();
  const noAssistente = pathname === '/importar';

  useEffect(() => {
    const permitir = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const soltar = (e: DragEvent) => {
      const arquivo = e.dataTransfer?.files[0];
      if (!arquivo || !PLANILHA.test(arquivo.name)) return;
      e.preventDefault();
      if (noAssistente) return;
      lerPlanilha(arquivo)
        .then((planilha) => {
          receberPlanilha(planilha);
          void navigate('/importar');
        })
        .catch((erro: unknown) => {
          toast.error(
            erro instanceof PlanilhaInvalida ? erro.message : 'Não deu para ler esse arquivo.',
          );
        });
    };
    window.addEventListener('dragover', permitir);
    window.addEventListener('drop', soltar);
    return () => {
      window.removeEventListener('dragover', permitir);
      window.removeEventListener('drop', soltar);
    };
  }, [navigate, receberPlanilha, noAssistente]);

  return (
    <TooltipProvider delayDuration={300}>
      <Outlet />
      <Toaster />
    </TooltipProvider>
  );
}
