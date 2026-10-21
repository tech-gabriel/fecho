import { GRUPOS_DE_ATALHOS } from '@/app/atalhos';
import { useApp } from '@/app/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function Teclas({ combinacao }: { combinacao: string }) {
  const partes = combinacao.split('+');
  return (
    <span className="flex items-center gap-1">
      {partes.map((tecla, i) => (
        <kbd
          key={`${tecla}-${String(i)}`}
          className="rounded-md border-b-2 bg-soft px-1.5 font-sans text-xs leading-4 font-medium"
        >
          {tecla}
        </kbd>
      ))}
    </span>
  );
}

export function FolhaDeAtalhos() {
  const aberta = useApp((s) => s.overlay === 'atalhos');
  const abrirOverlay = useApp((s) => s.abrirOverlay);

  return (
    <Dialog
      open={aberta}
      onOpenChange={(abrir) => {
        abrirOverlay(abrir ? 'atalhos' : null);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[800px] overflow-y-auto sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Tudo no Fechô funciona pelo teclado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {GRUPOS_DE_ATALHOS.map(({ grupo, atalhos }) => (
            <section key={grupo} aria-label={grupo}>
              <h3 className="mb-1 text-sm font-semibold">{grupo}</h3>
              <dl>
                {atalhos.map(({ acao, teclas }) => (
                  <div
                    key={acao}
                    className="flex h-8 items-center justify-between gap-4 border-t text-sm"
                  >
                    <dt className="text-ink-muted">{acao}</dt>
                    <dd className="flex items-center gap-2">
                      {teclas.map((t) => (
                        <Teclas key={t} combinacao={t} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
