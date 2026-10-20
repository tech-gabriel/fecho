import { usePaginaAtual } from './paginas';

export function EmBreve() {
  const pagina = usePaginaAtual();
  if (!pagina) return null;
  const Icone = pagina.icone;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-soft">
        <Icone size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
      </span>
      <p className="text-sm text-ink-muted">A tela {pagina.titulo} chega em breve.</p>
    </div>
  );
}
