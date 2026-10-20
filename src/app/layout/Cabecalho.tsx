import { Bell, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePaginaAtual } from '../paginas';
import { useApp } from '../store';
import { Dica, EM_BREVE, Kbd } from './apoio';

export function Cabecalho() {
  const pagina = usePaginaAtual();
  const abrirNovaCompra = useApp((s) => s.abrirNovaCompra);
  const legendaDinamica = useApp((s) => s.legendaDaPagina);
  const legenda = legendaDinamica ?? pagina?.legenda;

  return (
    <header className="flex flex-none items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.01em]">
          {pagina?.titulo}
        </h1>
        {legenda && <p className="text-sm text-ink-muted">{legenda}</p>}
      </div>

      <div className="flex flex-none items-center gap-2">
        <Dica texto={EM_BREVE}>
          <Button
            variant="outline"
            aria-disabled="true"
            aria-keyshortcuts="Control+K"
            className="w-[200px] justify-start pr-2 pl-3 font-normal text-ink-muted"
          >
            <Search strokeWidth={1.75} />
            <span className="flex-1 text-left">Buscar…</span>
            <Kbd className="bg-soft">Ctrl K</Kbd>
          </Button>
        </Dica>
        <Dica texto={EM_BREVE}>
          <Button variant="outline" size="icon" aria-disabled="true" aria-label="Alertas">
            <Bell strokeWidth={1.75} />
          </Button>
        </Dica>
        <Button
          aria-keyshortcuts="Control+N"
          className="pr-2 font-semibold"
          onClick={abrirNovaCompra}
        >
          <Plus strokeWidth={2} />
          Nova compra
          <Kbd className="bg-on-brand/12 text-on-brand">Ctrl N</Kbd>
        </Button>
      </div>
    </header>
  );
}
