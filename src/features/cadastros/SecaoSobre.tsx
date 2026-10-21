import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const RELEASES = 'https://github.com/tech-gabriel/fecho/releases';

export function SecaoSobre() {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(RELEASES);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  return (
    <section
      id="sobre"
      aria-labelledby="sobre-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="sobre-titulo" className="text-base font-semibold">
        Sobre
      </h2>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Fechô {__VERSAO__}</p>
        <p className="text-[13px] text-ink-muted">Seus dados ficam só neste computador.</p>
      </div>
      <div className="flex items-center gap-3 border-t pt-4">
        <p className="flex-1 text-sm text-ink-muted">
          Para atualizar, baixe o instalador novo em{' '}
          <span className="font-medium text-ink">{RELEASES.replace('https://', '')}</span> e instale
          por cima. Seus dados continuam.
        </p>
        <Button variant="outline" onClick={() => void copiar()}>
          <Copy strokeWidth={1.75} />
          Copiar link
        </Button>
      </div>
    </section>
  );
}
