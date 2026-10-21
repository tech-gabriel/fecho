import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Archive, Pencil, Plus, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Cadastro, Novo } from '@/data';
import { MesFechado } from '@/data/repositories';
import { nomeDoMes } from '@/lib/formato';
import type { PropsDoFormulario } from './formularios';

export interface Item {
  id: number;
  nome: string;
  ativo: boolean;
}

export interface Coluna<T> {
  cabecalho: string;
  largura: string;
  direita?: boolean;
  celula: (item: T) => ReactNode;
}

export interface ConfigDaSecao<T extends Item> {
  ancora: string;
  titulo: string;
  singular: string;
  feminino: boolean;
  repo: Cadastro<T>;
  icone: LucideIcon;
  vazio: string;
  marcador: (item: T) => ReactNode;
  colunas: Coluna<T>[];
  Formulario: (props: PropsDoFormulario<T>) => ReactNode;
  salvarEdicao?: (item: T, dados: Novo<T>, concluir: () => void) => Promise<void>;
  rodape?: ReactNode;
}

export async function executar(acao: () => Promise<void>) {
  try {
    await acao();
  } catch (erro) {
    if (erro instanceof MesFechado) {
      const mes = nomeDoMes(erro.competencia).split(' ')[0] ?? '';
      toast.error(`${mes} está fechado. Reabra o mês para mudar.`, {
        action: {
          label: 'Reabrir',
          onClick: () => {
            window.location.hash = `#/fechar/${erro.competencia}`;
          },
        },
      });
      return;
    }
    toast.error('Não foi possível salvar.', {
      action: { label: 'Tentar de novo', onClick: () => void executar(acao) },
    });
  }
}

const ativosPrimeiro = <T extends Item>(lista: T[]) =>
  lista.sort((a, b) => Number(b.ativo) - Number(a.ativo));

export function SecaoCadastro<T extends Item>(config: ConfigDaSecao<T>) {
  const { repo, singular, feminino, Formulario } = config;
  const idForm = useId();
  const [itens, setItens] = useState<T[]>([]);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<{ item: T; possuiCompras: boolean } | null>(null);

  const recarregar = useCallback(async () => {
    setItens(ativosPrimeiro(await repo.listar()));
  }, [repo]);

  useEffect(() => {
    let montado = true;
    void repo.listar().then((lista) => {
      if (montado) setItens(ativosPrimeiro(lista));
    });
    return () => {
      montado = false;
    };
  }, [repo]);

  const flexao = (masculino: string) => (feminino ? masculino.replace(/o$/, 'a') : masculino);
  const avisar = (acao: string, desfazer?: () => Promise<void>) => {
    toast.success(
      `${singular} ${flexao(acao)}`,
      desfazer && {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void executar(async () => {
              await desfazer();
              await recarregar();
            }),
        },
      },
    );
  };

  const concluirEdicao = () => {
    setEditando(null);
    void recarregar();
    avisar('salvo');
  };

  const criar = (dados: Novo<T>) =>
    executar(async () => {
      await repo.criar(dados);
      setCriando(false);
      await recarregar();
      avisar('salvo');
    });

  const salvar = (item: T, dados: Novo<T>) =>
    executar(async () => {
      if (config.salvarEdicao) {
        await config.salvarEdicao(item, dados, concluirEdicao);
        return;
      }
      await repo.atualizar(item.id, dados);
      concluirEdicao();
    });

  const abrirEdicao = (item: T) =>
    void repo.possuiCompras(item.id).then((possuiCompras) => {
      setEditando({ item, possuiCompras });
    });

  const alternarArquivo = (item: T) =>
    executar(async () => {
      const ativo = !item.ativo;
      await repo.atualizar(item.id, { ativo } as Partial<Novo<T>>);
      setEditando(null);
      await recarregar();
      avisar(ativo ? 'reativado' : 'arquivado', () =>
        repo.atualizar(item.id, { ativo: !ativo } as Partial<Novo<T>>),
      );
    });

  const excluir = (item: T) =>
    executar(async () => {
      await repo.excluir(item.id);
      setEditando(null);
      await recarregar();
      avisar('excluído', () => repo.restaurar(item.id));
    });

  const Icone = config.icone;
  const idTitulo = `${config.ancora}-titulo`;

  return (
    <section
      id={config.ancora}
      aria-labelledby={idTitulo}
      className="scroll-mt-6 rounded-lg border bg-surface"
    >
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h2 id={idTitulo} className="text-base font-semibold">
          {config.titulo}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCriando(true);
          }}
        >
          <Plus strokeWidth={1.75} />
          Adicionar
        </Button>
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 pt-4 pb-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-soft">
            <Icone size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
          </span>
          <p className="text-sm text-ink-muted">{config.vazio}</p>
        </div>
      ) : (
        <table className="w-full table-fixed text-[13px] leading-[18px]">
          <thead>
            <tr className="h-8 text-left text-xs font-medium text-ink-muted">
              <th scope="col" className="pl-6 font-medium">
                {singular}
              </th>
              {config.colunas.map((coluna) => (
                <th
                  key={coluna.cabecalho}
                  scope="col"
                  style={{ width: coluna.largura }}
                  className={cn('px-3 font-medium', coluna.direita && 'text-right')}
                >
                  {coluna.cabecalho}
                </th>
              ))}
              <th scope="col" className="w-[60px] pr-6">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="h-10 border-t">
                <td className="pl-6">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    {config.marcador(item)}
                    <span className="truncate">{item.nome}</span>
                    {!item.ativo && (
                      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-soft px-2 text-xs font-medium text-ink-muted-on-tint">
                        <Archive size={12} strokeWidth={1.75} aria-hidden />
                        Arquivado
                      </span>
                    )}
                  </span>
                </td>
                {config.colunas.map((coluna) => (
                  <td
                    key={coluna.cabecalho}
                    className={cn('px-3 tabular-nums', coluna.direita && 'text-right')}
                  >
                    {coluna.celula(item)}
                  </td>
                ))}
                <td className="pr-6 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${item.nome}`}
                    onClick={() => {
                      abrirEdicao(item);
                    }}
                    className="text-ink-muted"
                  >
                    <Pencil strokeWidth={1.75} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {config.rodape}

      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {feminino ? 'Nova' : 'Novo'} {singular.toLowerCase()}
            </DialogTitle>
            <DialogDescription className="sr-only">Preencha os dados e salve.</DialogDescription>
          </DialogHeader>
          <Formulario idForm={`${idForm}-novo`} onEnviar={(dados) => void criar(dados)} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCriando(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" form={`${idForm}-novo`}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEditando(null);
        }}
      >
        <SheetContent>
          {editando && (
            <>
              <SheetHeader>
                <SheetTitle>{editando.item.nome}</SheetTitle>
                <SheetDescription>
                  {editando.possuiCompras
                    ? `Tem compras registradas: pode ser arquivad${feminino ? 'a' : 'o'}, não excluíd${feminino ? 'a' : 'o'}.`
                    : 'Ainda sem compras registradas.'}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6">
                <Formulario
                  key={editando.item.id}
                  idForm={`${idForm}-edicao`}
                  inicial={editando.item}
                  onEnviar={(dados) => void salvar(editando.item, dados)}
                />
              </div>
              <SheetFooter>
                {editando.possuiCompras ? (
                  <Button variant="ghost" onClick={() => void alternarArquivo(editando.item)}>
                    {editando.item.ativo ? 'Arquivar' : 'Reativar'}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-danger-text hover:bg-danger-bg"
                    onClick={() => void excluir(editando.item)}
                  >
                    Excluir
                  </Button>
                )}
                <Button type="submit" form={`${idForm}-edicao`} className="ml-auto">
                  Salvar
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
