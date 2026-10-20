import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditarCompra } from '@/features/nova-compra/EditarCompra';
import { NovaCompra } from '@/features/nova-compra/NovaCompra';
import { DURACAO, MOVIMENTO, gsap, useGSAP } from '@/lib/gsap';
import { useAtalhosGlobais } from '../useAtalhosGlobais';
import { Cabecalho } from './Cabecalho';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  useAtalhosGlobais();
  const { pathname } = useLocation();
  const pagina = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add(MOVIMENTO, (contexto) => {
        const { reduzido } = contexto.conditions as { reduzido: boolean };
        gsap.from(
          pagina.current,
          reduzido
            ? { opacity: 0, duration: DURACAO.micro }
            : { opacity: 0, y: 8, duration: DURACAO.pagina, ease: 'power2.out' },
        );
      });
    },
    { dependencies: [pathname] },
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
          <Cabecalho />
          <div ref={pagina} className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
      <NovaCompra />
      <EditarCompra />
      <Toaster />
    </TooltipProvider>
  );
}
