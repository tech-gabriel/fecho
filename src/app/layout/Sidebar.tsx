import { Lock, PanelLeft } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from 'cn';
import { LogoSimbolo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { CONFIGURACOES, PAGINAS, type Pagina } from '../paginas';
import { useApp } from '../store';
import { usePedirBloqueio } from '../useBloqueio';
import { Dica, Kbd } from './apoio';
import { SeletorMes, SeletorMesRecolhido } from './SeletorMes';

const estiloItem = (recolhida: boolean) =>
  cn(
    'flex h-9 items-center gap-3 rounded-md text-sm text-ink hover:bg-soft',
    recolhida ? 'justify-center' : 'px-3',
  );

function ItemNav({ pagina, recolhida }: { pagina: Pagina; recolhida: boolean }) {
  const Icone = pagina.icone;
  const link = (
    <NavLink
      to={pagina.caminho}
      end
      aria-label={recolhida ? pagina.rotulo : undefined}
      className={cn(
        estiloItem(recolhida),
        'group aria-[current=page]:bg-brand-subtle aria-[current=page]:font-semibold',
      )}
    >
      <Icone
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="flex-none text-ink-muted group-aria-[current=page]:text-brand-text"
      />
      {!recolhida && <span className="flex-1">{pagina.rotulo}</span>}
    </NavLink>
  );

  return recolhida ? (
    <Dica texto={pagina.rotulo} lado="right">
      {link}
    </Dica>
  ) : (
    link
  );
}

export function Sidebar() {
  const { sidebarRecolhida: recolhida, alternarSidebar } = useApp();
  const pedirBloqueio = usePedirBloqueio();

  return (
    <aside
      className={cn(
        'flex flex-none flex-col gap-4 border-r bg-surface px-3 py-4',
        recolhida ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)',
      )}
    >
      <div className={cn('flex h-9 items-center gap-2 px-1', recolhida && 'justify-center')}>
        <LogoSimbolo size={24} className="flex-none text-brand" />
        {!recolhida && (
          <>
            <span className="flex-1 text-xl font-bold tracking-[-0.025em]">Fechô</span>
            <Dica texto="Recolher (Ctrl+B)">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Recolher a barra lateral"
                aria-keyshortcuts="Control+B"
                onClick={alternarSidebar}
                className="text-ink-muted"
              >
                <PanelLeft strokeWidth={1.75} />
              </Button>
            </Dica>
          </>
        )}
      </div>

      {recolhida ? <SeletorMesRecolhido /> : <SeletorMes />}

      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {PAGINAS.map((pagina) => (
          <ItemNav key={pagina.caminho} pagina={pagina} recolhida={recolhida} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <ItemNav pagina={CONFIGURACOES} recolhida={recolhida} />
        <Dica texto="Bloquear (Ctrl+L)" lado="right">
          <button
            type="button"
            aria-label={recolhida ? 'Bloquear' : undefined}
            aria-keyshortcuts="Control+L"
            onClick={pedirBloqueio}
            className={estiloItem(recolhida)}
          >
            <Lock size={16} strokeWidth={1.75} aria-hidden className="flex-none text-ink-muted" />
            {!recolhida && (
              <>
                <span className="flex-1 text-left">Bloquear</span>
                <Kbd className="border px-1.5 py-px text-ink-muted">Ctrl L</Kbd>
              </>
            )}
          </button>
        </Dica>
      </div>
    </aside>
  );
}
