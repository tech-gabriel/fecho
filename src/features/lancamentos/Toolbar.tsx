import type { RefObject } from 'react';
import { ChevronDown, Columns3, Search, Upload, X } from 'lucide-react';
import { cn } from 'cn';
import { Dica, EM_BREVE } from '@/app/layout/apoio';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Cartao, Categoria } from '@/data';

export interface Filtros {
  q: string;
  ver: 'meu' | 'terceiros' | 'todos';
  cartoes: number[];
  categorias: number[];
}

export type ColunaOpcional = 'categoria' | 'cartao' | 'dono';
export type Colunas = Record<ColunaOpcional, boolean>;

const ROTULOS_DAS_COLUNAS: [ColunaOpcional, string][] = [
  ['categoria', 'Categoria'],
  ['cartao', 'Cartão'],
  ['dono', 'De quem'],
];

const VER: [Filtros['ver'], string][] = [
  ['meu', 'Meu'],
  ['terceiros', 'Terceiros'],
  ['todos', 'Todos'],
];

const chip =
  'flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium hover:bg-soft';

function FiltroEmChip({
  rotulo,
  todos,
  opcoes,
  escolhidos,
  onEscolher,
}: {
  rotulo: string;
  todos: string;
  opcoes: { id: number; nome: string }[];
  escolhidos: number[];
  onEscolher: (ids: number[]) => void;
}) {
  const nomes = opcoes.filter((o) => escolhidos.includes(o.id)).map((o) => o.nome);
  const resumo =
    nomes.length === 0 ? todos : nomes.length === 1 ? nomes[0] : `${nomes.length} escolhidos`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(chip, nomes.length > 0 && 'border-transparent bg-brand-subtle')}
        >
          {rotulo}: {resumo}
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-56 flex-col gap-1 p-2">
        {opcoes.map((opcao) => {
          const id = `filtro-${rotulo}-${opcao.id}`;
          return (
            <label
              key={opcao.id}
              htmlFor={id}
              className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-soft"
            >
              <Checkbox
                id={id}
                checked={escolhidos.includes(opcao.id)}
                onCheckedChange={(marcado) => {
                  onEscolher(
                    marcado === true
                      ? [...escolhidos, opcao.id]
                      : escolhidos.filter((e) => e !== opcao.id),
                  );
                }}
              />
              {opcao.nome}
            </label>
          );
        })}
        {escolhidos.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              onEscolher([]);
            }}
          >
            Mostrar todos
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function Toolbar({
  filtros,
  cartoes,
  categorias,
  colunas,
  campoDeBusca,
  onMudar,
  onColunas,
}: {
  filtros: Filtros;
  cartoes: Cartao[];
  categorias: Categoria[];
  colunas: Colunas;
  campoDeBusca: RefObject<HTMLInputElement | null>;
  onMudar: (mudanca: Partial<Filtros>) => void;
  onColunas: (colunas: Colunas) => void;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2">
      <div className="relative w-[200px]">
        <Search
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
        />
        <input
          ref={campoDeBusca}
          type="search"
          aria-label="Filtrar por descrição"
          aria-keyshortcuts="Control+F"
          placeholder="Filtrar por descrição"
          value={filtros.q}
          onChange={(e) => {
            onMudar({ q: e.target.value });
          }}
          className="h-8 w-full rounded-md border border-border-strong bg-surface pr-3 pl-9 text-sm placeholder:text-ink-muted"
        />
      </div>
      <FiltroEmChip
        rotulo="Cartão"
        todos="todos"
        opcoes={cartoes}
        escolhidos={filtros.cartoes}
        onEscolher={(ids) => {
          onMudar({ cartoes: ids });
        }}
      />
      <FiltroEmChip
        rotulo="Categoria"
        todos="todas"
        opcoes={categorias}
        escolhidos={filtros.categorias}
        onEscolher={(ids) => {
          onMudar({ categorias: ids });
        }}
      />
      {filtros.q && (
        <button
          type="button"
          aria-label={`Limpar a busca por “${filtros.q}”`}
          onClick={() => {
            onMudar({ q: '' });
          }}
          className={cn(chip, 'border-transparent bg-soft')}
        >
          “{filtros.q}”
          <X size={14} strokeWidth={1.75} aria-hidden />
        </button>
      )}

      <div className="flex-1" />

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Mostrar"
        value={filtros.ver}
        onValueChange={(valor) => {
          if (valor) onMudar({ ver: valor as Filtros['ver'] });
        }}
      >
        {VER.map(([valor, rotulo]) => (
          <ToggleGroupItem
            key={valor}
            value={valor}
            className="px-3 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
          >
            {rotulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns3 strokeWidth={1.75} />
            Colunas
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-48 flex-col gap-1 p-2">
          <span className="px-2 py-1 text-xs font-medium text-ink-muted">Mostrar colunas</span>
          {ROTULOS_DAS_COLUNAS.map(([coluna, rotulo]) => (
            <label
              key={coluna}
              htmlFor={`coluna-${coluna}`}
              className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-soft"
            >
              <Checkbox
                id={`coluna-${coluna}`}
                checked={colunas[coluna]}
                onCheckedChange={(marcado) => {
                  onColunas({ ...colunas, [coluna]: marcado === true });
                }}
              />
              {rotulo}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      <Dica texto={EM_BREVE}>
        <Button variant="outline" size="sm" aria-disabled="true">
          <Upload strokeWidth={1.75} />
          Importar .xlsx
        </Button>
      </Dica>
    </div>
  );
}
