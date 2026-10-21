import { Keyboard } from 'lucide-react';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';

export function SecaoAtalhos() {
  const abrirOverlay = useApp((s) => s.abrirOverlay);
  return (
    <section
      id="atalhos"
      aria-labelledby="atalhos-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="atalhos-titulo" className="text-base font-semibold">
        Atalhos
      </h2>
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-ink-muted">
          Tudo no Fechô funciona pelo teclado. Aperte ? em qualquer tela para ver a lista.
        </p>
        <Button
          variant="outline"
          aria-keyshortcuts="?"
          onClick={() => {
            abrirOverlay('atalhos');
          }}
        >
          <Keyboard strokeWidth={1.75} />
          Ver atalhos
        </Button>
      </div>
    </section>
  );
}
