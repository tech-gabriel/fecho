import { createElement, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Categoria } from '@/data';
import { iconeDaCategoria } from '@/features/cadastros/opcoes';

export function ComboCategoria({
  id,
  categorias,
  valor,
  sugerida,
  onEscolher,
}: {
  id: string;
  categorias: Categoria[];
  valor: number | null;
  sugerida: boolean;
  onEscolher: (categoriaId: number | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = categorias.find((c) => c.id === valor);

  const escolher = (categoriaId: number | null) => {
    onEscolher(categoriaId);
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className="w-full justify-start px-3 font-normal"
        >
          {atual &&
            createElement(iconeDaCategoria(atual.icone), {
              strokeWidth: 1.75,
              className: 'text-ink-muted',
            })}
          <span className={cn('flex-1 truncate text-left', !atual && 'text-ink-muted')}>
            {atual?.nome ?? 'Sem categoria'}
          </span>
          {sugerida && atual && (
            <span className="rounded-md bg-brand-subtle px-1.5 text-xs font-medium text-brand-text">
              sugerida
            </span>
          )}
          <ChevronsUpDown strokeWidth={1.75} className="text-ink-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar categoria…" />
          <CommandList>
            <CommandEmpty>Nenhuma categoria com esse nome.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Sem categoria"
                onSelect={() => {
                  escolher(null);
                }}
              >
                <span className="flex-1">Sem categoria</span>
                {valor === null && <Check strokeWidth={1.75} />}
              </CommandItem>
              {categorias.map((categoria) => {
                return (
                  <CommandItem
                    key={categoria.id}
                    value={categoria.nome}
                    onSelect={() => {
                      escolher(categoria.id);
                    }}
                  >
                    {createElement(iconeDaCategoria(categoria.icone), {
                      strokeWidth: 1.75,
                      className: 'text-ink-muted',
                    })}
                    <span className="flex-1">{categoria.nome}</span>
                    {valor === categoria.id && <Check strokeWidth={1.75} />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
