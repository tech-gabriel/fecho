import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, CalendarClock, Layers, Repeat, UserRound } from 'lucide-react';
import { hojeLocal } from '@/app/store';
import { cn } from 'cn';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Categoria, Terceiro } from '@/data';
import type { Competencia } from '@/domain/competencia';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import { BarraDeSelecao } from './BarraDeSelecao';
import type { LinhaDeLancamento } from './Lancamentos';
import type { Colunas } from './Toolbar';

export interface AcoesDaTabela {
  renomear: (compraId: number, descricao: string) => Promise<void>;
  mudarCategoria: (compraIds: number[], categoriaId: number | null) => Promise<void>;
  mudarDono: (compraIds: number[], dono: number | null) => Promise<void>;
  excluir: (compraIds: number[]) => Promise<void>;
  duplicar: (compraId: number) => Promise<void>;
  editar: (compraId: number) => void;
}

const recursos = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
});
const coluna = createColumnHelper<typeof recursos, LinhaDeLancamento>();
const colunas = coluna.columns([
  coluna.display({ id: 'selecao', header: 'Selecionar', enableSorting: false }),
  coluna.accessor('dataCompra', { id: 'data', header: 'Data', sortFn: 'basic' }),
  coluna.accessor('descricao', { id: 'descricao', header: 'Descrição', enableSorting: false }),
  coluna.accessor('categoria', { id: 'categoria', header: 'Categoria', enableSorting: false }),
  coluna.accessor((l) => l.cartao?.nome ?? '', {
    id: 'cartao',
    header: 'Cartão',
    enableSorting: false,
  }),
  coluna.accessor('nomeDono', { id: 'dono', header: 'De quem', enableSorting: false }),
  coluna.accessor('valorCentavos', {
    id: 'valor',
    header: 'Valor',
    sortFn: 'basic',
    sortDescFirst: true,
  }),
]);

const LARGURAS: Record<string, string> = {
  selecao: '36px',
  data: '92px',
  categoria: '128px',
  cartao: '150px',
  dono: '110px',
  valor: '112px',
};

const dataLonga = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
const unicos = (linhas: LinhaDeLancamento[]) => [...new Set(linhas.map((l) => l.compraId))];

export function TabelaDeLancamentos({
  linhas,
  competencia,
  colunas: visiveis,
  categorias,
  terceiros,
  acoes,
}: {
  linhas: LinhaDeLancamento[];
  competencia: Competencia;
  colunas: Colunas;
  categorias: Categoria[];
  terceiros: Terceiro[];
  acoes: AcoesDaTabela;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const hoje = hojeLocal();
  const [ativa, setAtiva] = useState(0);
  const [ancora, setAncora] = useState<number | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const linhasDom = useRef<(HTMLTableRowElement | null)[]>([]);

  const tabela = useTable({
    features: recursos,
    columns: colunas,
    data: linhas,
    getRowId: (l) => l.id,
    state: { sorting, rowSelection, columnVisibility: visiveis },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
  });

  const rows = tabela.getRowModel().rows;
  const selecionadas = rows.filter((r) => r.getIsSelected()).map((r) => r.original);
  const indiceAtivo = Math.min(ativa, rows.length - 1);

  const limparSelecao = () => {
    setRowSelection({});
  };
  const alvo = (linha: LinhaDeLancamento | undefined) =>
    linha && rowSelection[linha.id] ? unicos(selecionadas) : linha ? [linha.compraId] : [];
  const selecaoOuAtiva = (linha: LinhaDeLancamento | undefined) =>
    selecionadas.length > 0 ? unicos(selecionadas) : alvo(linha);
  const depois = async (acao: Promise<void>) => {
    await acao;
    limparSelecao();
  };

  const focar = (indice: number) => {
    setAtiva(indice);
    linhasDom.current[indice]?.focus();
  };

  const selecionarIntervalo = (de: number, ate: number) => {
    const [ini, fim] = de < ate ? [de, ate] : [ate, de];
    setRowSelection(Object.fromEntries(rows.slice(ini, fim + 1).map((r) => [r.id, true])));
  };

  const aoClicar = (e: MouseEvent, indice: number) => {
    setAtiva(indice);
    const row = rows[indice];
    if (!row) return;
    if (e.shiftKey && ancora !== null) {
      selecionarIntervalo(ancora, indice);
      return;
    }
    if (e.ctrlKey || e.metaKey) row.toggleSelected();
    setAncora(indice);
  };

  const concluirEdicao = async (linha: LinhaDeLancamento, salvar: boolean) => {
    const texto = editando?.texto.trim() ?? '';
    setEditando(null);
    linhasDom.current[indiceAtivo]?.focus();
    if (salvar && texto && texto !== linha.descricao) await acoes.renomear(linha.compraId, texto);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTableElement>) => {
    if ((e.target as HTMLElement).closest('input')) return;
    const row = rows[indiceAtivo];
    const linha = row?.original;
    const ctrl = e.ctrlKey || e.metaKey;
    const comandos: Record<string, (() => void) | undefined> = {
      ArrowDown: () => {
        focar(Math.min(indiceAtivo + 1, rows.length - 1));
      },
      ArrowUp: () => {
        focar(Math.max(indiceAtivo - 1, 0));
      },
      ' ': () => row?.toggleSelected(),
      F2: () => {
        if (linha) setEditando({ id: linha.id, texto: linha.descricao });
      },
      Enter: () => {
        if (linha) acoes.editar(linha.compraId);
      },
      Delete: () => void depois(acoes.excluir(selecaoOuAtiva(linha))),
      Escape: limparSelecao,
    };
    const atalho = ctrl
      ? {
          a: () => {
            tabela.toggleAllRowsSelected(true);
          },
          d: () => void (linha && acoes.duplicar(linha.compraId)),
        }[e.key.toLowerCase()]
      : comandos[e.key];
    if (!atalho) return;
    e.preventDefault();
    atalho();
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className={cn('min-h-0 flex-1 overflow-auto', selecionadas.length > 0 && 'pb-14')}>
        <table
          role="grid"
          aria-multiselectable="true"
          aria-label={`Lançamentos de ${nomeDoMes(competencia)}`}
          onKeyDown={aoTeclar}
          className="w-full table-fixed text-[13px] leading-[18px] font-medium"
        >
          <colgroup>
            {tabela.getVisibleLeafColumns().map((c) => (
              <col key={c.id} style={{ width: LARGURAS[c.id] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-surface">
            {tabela.getHeaderGroups().map((grupo) => (
              <tr key={grupo.id} className="h-9 border-b text-left text-xs text-ink-muted">
                {grupo.headers.map((cabecalho) => {
                  const id = cabecalho.column.id;
                  const ordem = cabecalho.column.getIsSorted();
                  const direita = id === 'valor';
                  if (id === 'selecao') {
                    return (
                      <th key={id} scope="col" className="pl-4">
                        <Checkbox
                          aria-label="Selecionar todos"
                          checked={
                            tabela.getIsAllRowsSelected()
                              ? true
                              : tabela.getIsSomeRowsSelected()
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(marcado) => {
                            tabela.toggleAllRowsSelected(marcado === true);
                          }}
                        />
                      </th>
                    );
                  }
                  const titulo = String(cabecalho.column.columnDef.header);
                  return (
                    <th
                      key={id}
                      scope="col"
                      aria-sort={
                        ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : undefined
                      }
                      className={cn('px-3 font-medium', direita && 'pr-4 text-right')}
                    >
                      {cabecalho.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={cabecalho.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 hover:text-ink',
                            ordem && 'text-ink',
                          )}
                        >
                          {titulo}
                          {ordem === 'asc' && <ArrowUp size={12} strokeWidth={1.75} aria-hidden />}
                          {ordem === 'desc' && (
                            <ArrowDown size={12} strokeWidth={1.75} aria-hidden />
                          )}
                        </button>
                      ) : (
                        titulo
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row, indice) => {
              const linha = row.original;
              const selecionada = row.getIsSelected();
              return (
                <ContextMenu
                  key={row.id}
                  onOpenChange={(aberto) => {
                    if (aberto) setAtiva(indice);
                  }}
                >
                  <ContextMenuTrigger asChild>
                    <tr
                      ref={(el) => {
                        linhasDom.current[indice] = el;
                      }}
                      aria-selected={selecionada}
                      tabIndex={indice === indiceAtivo ? 0 : -1}
                      onFocus={(e) => {
                        if (e.target === e.currentTarget) setAtiva(indice);
                      }}
                      onClick={(e) => {
                        aoClicar(e, indice);
                      }}
                      onDoubleClick={() => {
                        setAtiva(indice);
                        setEditando({ id: linha.id, texto: linha.descricao });
                      }}
                      className={cn(
                        'h-10 border-b',
                        selecionada ? 'bg-brand-subtle' : 'hover:bg-soft',
                      )}
                    >
                      {row.getVisibleCells().map((celula) => {
                        const id = celula.column.id;
                        if (id === 'selecao') {
                          return (
                            <td key={id} className="pl-4">
                              <Checkbox
                                aria-label={`Selecionar ${linha.descricao}`}
                                checked={selecionada}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAtiva(indice);
                                  if (e.shiftKey && ancora !== null) {
                                    e.preventDefault();
                                    selecionarIntervalo(ancora, indice);
                                  } else {
                                    setAncora(indice);
                                  }
                                }}
                                onCheckedChange={(marcado) => {
                                  row.toggleSelected(marcado === true);
                                }}
                              />
                            </td>
                          );
                        }
                        if (id === 'data') {
                          return (
                            <td key={id} className="px-3 text-ink-muted tabular-nums">
                              {dataLonga(linha.dataCompra)}
                            </td>
                          );
                        }
                        if (id === 'descricao') {
                          return (
                            <td key={id} className="px-3">
                              {editando?.id === linha.id ? (
                                <input
                                  aria-label="Descrição"
                                  value={editando.texto}
                                  ref={(el) => {
                                    el?.focus();
                                  }}
                                  onChange={(e) => {
                                    setEditando({ id: linha.id, texto: e.target.value });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void concluirEdicao(linha, true);
                                    if (e.key === 'Escape') {
                                      e.stopPropagation();
                                      void concluirEdicao(linha, false);
                                    }
                                  }}
                                  onBlur={() => void concluirEdicao(linha, true)}
                                  className="h-7 w-full rounded-md border border-border-strong bg-surface px-2"
                                />
                              ) : (
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="truncate">{linha.descricao}</span>
                                  {linha.numParcelas > 1 && (
                                    <span className="flex flex-none items-center gap-1 text-xs text-ink-muted tabular-nums">
                                      <Layers size={12} strokeWidth={1.75} aria-hidden />
                                      {linha.numero}/{linha.numParcelas}
                                    </span>
                                  )}
                                  {linha.recorrente && (
                                    <Repeat
                                      size={12}
                                      strokeWidth={1.75}
                                      aria-label="Repete todo mês"
                                      className="flex-none text-ink-muted"
                                    />
                                  )}
                                  {linha.dataCompra > hoje && (
                                    <span className="flex flex-none items-center gap-1 rounded-full bg-soft px-2 text-xs leading-5 font-medium text-ink-muted-on-tint">
                                      <CalendarClock size={12} strokeWidth={1.75} aria-hidden />
                                      Prevista
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                          );
                        }
                        if (id === 'categoria') {
                          return (
                            <td key={id} className="truncate px-3 font-normal text-ink-muted">
                              {linha.categoria || '—'}
                            </td>
                          );
                        }
                        if (id === 'cartao') {
                          return (
                            <td key={id} className="px-3 font-normal">
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden
                                  style={{ backgroundColor: linha.cartao?.cor }}
                                  className="h-[11px] w-4 flex-none rounded-sm"
                                />
                                <span className="truncate">{linha.cartao?.nome}</span>
                              </span>
                            </td>
                          );
                        }
                        if (id === 'dono') {
                          return (
                            <td key={id} className="px-3">
                              {linha.dono === null ? (
                                <span className="text-ink-muted">Meu</span>
                              ) : (
                                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-info-bg px-2 text-xs font-medium text-info-text">
                                  <UserRound
                                    size={12}
                                    strokeWidth={1.75}
                                    aria-hidden
                                    className="flex-none"
                                  />
                                  <span className="truncate">{linha.nomeDono}</span>
                                </span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={id} className="pr-4 text-right tabular-nums">
                            {formatarMoeda(linha.valorCentavos)}
                          </td>
                        );
                      })}
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem
                      onSelect={() => {
                        acoes.editar(linha.compraId);
                      }}
                    >
                      Editar compra…
                      <ContextMenuShortcut>Enter</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() => {
                        setEditando({ id: linha.id, texto: linha.descricao });
                      }}
                    >
                      Editar descrição
                      <ContextMenuShortcut>F2</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void acoes.duplicar(linha.compraId)}>
                      Duplicar
                      <ContextMenuShortcut>Ctrl D</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>Marcar como de…</ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-40">
                        <ContextMenuItem
                          onSelect={() => void depois(acoes.mudarDono(alvo(linha), null))}
                        >
                          Meu
                        </ContextMenuItem>
                        {terceiros.map((t) => (
                          <ContextMenuItem
                            key={t.id}
                            onSelect={() => void depois(acoes.mudarDono(alvo(linha), t.id))}
                          >
                            {t.nome}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => void depois(acoes.excluir(alvo(linha)))}
                    >
                      Excluir
                      <ContextMenuShortcut>Del</ContextMenuShortcut>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>

      {selecionadas.length > 0 && (
        <BarraDeSelecao
          quantidade={selecionadas.length}
          categorias={categorias}
          terceiros={terceiros}
          onCategoria={(categoriaId) =>
            void depois(acoes.mudarCategoria(unicos(selecionadas), categoriaId))
          }
          onDono={(dono) => void depois(acoes.mudarDono(unicos(selecionadas), dono))}
          onExcluir={() => void depois(acoes.excluir(unicos(selecionadas)))}
          onLimpar={limparSelecao}
        />
      )}
    </div>
  );
}
