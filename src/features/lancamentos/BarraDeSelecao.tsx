import { createElement } from 'react';
import { ChevronDown, Trash2, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Categoria, Terceiro } from '@/data';
import { iconeDaCategoria } from '@/features/cadastros/opcoes';

const opcao = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-soft';

export function BarraDeSelecao({
  quantidade,
  categorias,
  terceiros,
  onCategoria,
  onDono,
  onExcluir,
  onLimpar,
}: {
  quantidade: number;
  categorias: Categoria[];
  terceiros: Terceiro[];
  onCategoria: (categoriaId: number | null) => void;
  onDono: (dono: number | null) => void;
  onExcluir: () => void;
  onLimpar: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Ações da seleção"
      className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-surface-raised p-1 pl-4 shadow-popover"
    >
      <span className="mr-2 text-[13px] font-semibold whitespace-nowrap tabular-nums">
        {quantidade} {quantidade === 1 ? 'selecionado' : 'selecionados'}
      </span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            Mudar categoria
            <ChevronDown strokeWidth={1.75} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="flex max-h-72 w-52 flex-col overflow-y-auto p-1">
          <button
            type="button"
            className={opcao}
            onClick={() => {
              onCategoria(null);
            }}
          >
            Sem categoria
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              className={opcao}
              onClick={() => {
                onCategoria(c.id);
              }}
            >
              {createElement(iconeDaCategoria(c.icone), {
                size: 16,
                strokeWidth: 1.75,
                'aria-hidden': true,
                className: 'text-ink-muted',
              })}
              {c.nome}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            De quem é
            <ChevronDown strokeWidth={1.75} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="flex w-44 flex-col p-1">
          <button
            type="button"
            className={opcao}
            onClick={() => {
              onDono(null);
            }}
          >
            Meu
          </button>
          {terceiros.map((t) => (
            <button
              key={t.id}
              type="button"
              className={opcao}
              onClick={() => {
                onDono(t.id);
              }}
            >
              <UserRound size={14} strokeWidth={1.75} aria-hidden className="text-info" />
              {t.nome}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        onClick={onExcluir}
        className="text-danger-text hover:bg-danger-bg"
      >
        <Trash2 strokeWidth={1.75} />
        Excluir
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Limpar seleção (Esc)"
        onClick={onLimpar}
        className="text-ink-muted"
      >
        <X strokeWidth={1.75} />
      </Button>
    </div>
  );
}
