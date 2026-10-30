import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { MoreHorizontal, Plus, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Categoria, ContaFixa, PagamentoDeConta } from '@/data';
import { contasDoMes, type ContaDoMes } from '@/domain/contasFixas';
import { BotoesDoFormulario } from '@/features/assinaturas/FormularioDeAssinatura';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { EntradaEmReais } from '@/features/cadastros/formularios';
import { iconeDaCategoria } from '@/features/cadastros/opcoes';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { dataCurta, SeloDeStatus } from '@/features/faturas/ListaDeCartoes';
import { formatarDecimal, formatarMoeda, nomeDoMes } from '@/lib/formato';
import { FormularioDeConta, valorPositivo, type ContaDoFormulario } from './FormularioDeConta';

interface Dados {
  contas: ContaFixa[];
  pagamentos: PagamentoDeConta[];
  categorias: Categoria[];
}

const ORDEM = { atrasada: 0, pendente: 1, paga: 2 };
const mesCurto = (c: string) => nomeDoMes(c).split(' ')[0] ?? '';

function Tile({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4">
      <span className="text-[13px] text-ink-muted">{rotulo}</span>
      <span className="text-xl font-semibold tabular-nums">{valor}</span>
    </div>
  );
}

function DialogPagar({
  item,
  hoje,
  onFechar,
  onPagar,
}: {
  item: ContaDoMes;
  hoje: string;
  onFechar: () => void;
  onPagar: (valor: number, pagoEm: string) => Promise<void>;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { valor: formatarDecimal(item.valor), pagoEm: hoje } });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(({ valor, pagoEm }) => {
          const centavos = valorPositivo(valor);
          if (centavos === null) {
            setError('valor', { message: 'Digite um valor maior que zero' });
            return;
          }
          return executar(() => onPagar(centavos, pagoEm));
        })();
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Campo
          id={`${id}-valor`}
          rotulo="Valor pago"
          erro={errors.valor?.message}
          dica={`Referência: ${formatarMoeda(item.conta.valorCentavos)}`}
        >
          <EntradaEmReais
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            {...register('valor')}
          />
        </Campo>
        <Campo id={`${id}-data`} rotulo="Pago em">
          <Input id={`${id}-data`} type="date" {...register('pagoEm', { required: true })} />
        </Campo>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" className="font-semibold">
          Marcar paga
        </Button>
      </div>
    </form>
  );
}

export function ContasFixas() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const hoje = hojeLocal();
  const [dados, setDados] = useState<Dados | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<ContaFixa | null>(null);
  const [pagando, setPagando] = useState<ContaDoMes | null>(null);

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.contasFixas.listar(),
      repos.contasFixas.pagamentos(),
      repos.categorias.listar(),
    ]).then(([contas, pagamentos, categorias]) => {
      if (montado) setDados({ contas, pagamentos, categorias });
    });
    return () => {
      montado = false;
    };
  }, [repos, versao]);

  if (!dados) return null;

  const itens = contasDoMes(dados.contas, dados.pagamentos, competencia, hoje).sort(
    (a, b) => ORDEM[a.status] - ORDEM[b.status] || a.vencimento.localeCompare(b.vencimento),
  );
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const pago = itens.filter((i) => i.pagamento).reduce((s, i) => s + i.valor, 0);
  const mes = mesCurto(competencia);

  const criar = async (conta: ContaDoFormulario) => {
    await repos.contasFixas.criar({ ...conta, ativa: true, rateios: [] });
    setCriando(false);
    dadosMudaram();
    toast.success(`${conta.descricao} cadastrada`);
  };

  const salvar = async (original: ContaFixa, conta: ContaDoFormulario) => {
    await repos.contasFixas.atualizar(original.id, conta);
    setEditando(null);
    dadosMudaram();
    toast.success('Conta salva');
  };

  const pagar = async (item: ContaDoMes, valorCentavos: number, pagoEm: string) => {
    await repos.contasFixas.marcarPaga({
      contaId: item.conta.id,
      competencia: item.competencia,
      valorCentavos,
      pagoEm,
    });
    setPagando(null);
    dadosMudaram();
    toast.success(`${item.conta.descricao} marcada como paga`, {
      action: {
        label: 'Desfazer',
        onClick: () => void desmarcar(item, false),
      },
    });
  };

  const desmarcar = (item: ContaDoMes, avisar = true) =>
    executar(async () => {
      const anterior = item.pagamento;
      await repos.contasFixas.desmarcar(item.conta.id, item.competencia);
      dadosMudaram();
      if (avisar && anterior) {
        toast.success(`${item.conta.descricao} voltou para pendente`, {
          action: {
            label: 'Desfazer',
            onClick: () =>
              void executar(async () => {
                await repos.contasFixas.marcarPaga(anterior);
                dadosMudaram();
              }),
          },
        });
      }
    });

  const arquivar = (conta: ContaFixa, ativa: boolean) =>
    executar(async () => {
      await repos.contasFixas.atualizar(conta.id, { ativa });
      dadosMudaram();
      toast.success(ativa ? `${conta.descricao} reativada` : `${conta.descricao} arquivada`, {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void executar(async () => {
              await repos.contasFixas.atualizar(conta.id, { ativa: !ativa });
              dadosMudaram();
            }),
        },
      });
    });

  const excluir = (conta: ContaFixa) =>
    executar(async () => {
      if (await repos.contasFixas.possuiCompras(conta.id)) {
        toast.info(`${conta.descricao} tem pagamentos registrados. Arquive em vez de excluir.`);
        return;
      }
      await repos.contasFixas.excluir(conta.id);
      dadosMudaram();
      toast.success(`${conta.descricao} excluída`, {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void executar(async () => {
              await repos.contasFixas.restaurar(conta.id);
              dadosMudaram();
            }),
        },
      });
    });

  const arquivadas = dados.contas.filter((c) => !c.ativa);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="grid grid-cols-3 gap-4">
        <Tile rotulo={`Total de ${mes}`} valor={formatarMoeda(total)} />
        <Tile rotulo="Pago" valor={formatarMoeda(pago)} />
        <Tile rotulo="Falta pagar" valor={formatarMoeda(total - pago)} />
      </div>

      <section
        aria-labelledby="lista-contas"
        className="flex flex-col rounded-lg border bg-surface"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 id="lista-contas" className="text-base font-semibold">
            Contas de {mes}
          </h2>
          <Button
            variant="outline"
            onClick={() => {
              setCriando(true);
            }}
          >
            <Plus strokeWidth={1.75} />
            Nova conta
          </Button>
        </div>

        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-soft">
              <ReceiptText
                size={24}
                strokeWidth={1.75}
                aria-hidden
                className="text-ink-muted-on-tint"
              />
            </span>
            <p className="text-sm text-ink-muted">
              Cadastre o que você paga todo mês fora do cartão: aluguel, plano de saúde, luz…
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="h-10 border-y text-left text-xs text-ink-muted">
                <th scope="col" className="pl-6 font-medium">
                  Conta
                </th>
                <th scope="col" className="w-28 px-3 font-medium">
                  Vence
                </th>
                <th scope="col" className="w-36 px-3 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="w-36 px-3 font-medium">
                  Situação
                </th>
                <th scope="col" className="w-48 pr-6 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const { conta } = item;
                const categoria = dados.categorias.find((c) => c.id === conta.categoriaId);
                const Icone = iconeDaCategoria(categoria?.icone ?? 'receipt-text');
                return (
                  <tr key={conta.id} className="h-12 border-b last:border-b-0 hover:bg-soft">
                    <td className="pl-6">
                      <span className="flex items-center gap-3">
                        <span className="flex size-7 flex-none items-center justify-center rounded-md bg-brand-subtle text-brand-text">
                          <Icone size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{conta.descricao}</span>
                          {categoria && (
                            <span className="truncate text-xs text-ink-muted">
                              {categoria.nome}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 text-ink-muted tabular-nums">
                      {dataCurta(item.vencimento)}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      <span className="font-medium">{formatarMoeda(item.valor)}</span>
                      {item.ajustado && (
                        <span className="block text-xs text-ink-muted">ajustado no mês</span>
                      )}
                    </td>
                    <td className="px-3">
                      <SeloDeStatus
                        status={item.status}
                        texto={
                          item.pagamento ? `Paga em ${dataCurta(item.pagamento.pagoEm)}` : undefined
                        }
                      />
                    </td>
                    <td className="pr-6">
                      <span className="flex items-center justify-end gap-1">
                        {item.pagamento ? (
                          <Button variant="ghost" size="sm" onClick={() => void desmarcar(item)}>
                            Desmarcar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPagando(item);
                            }}
                          >
                            Marcar paga
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Mais ações de ${conta.descricao}`}
                            >
                              <MoreHorizontal strokeWidth={1.75} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditando(conta);
                              }}
                            >
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void arquivar(conta, !conta.ativa)}>
                              {conta.ativa ? 'Arquivar' : 'Reativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void excluir(conta)}>
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {arquivadas.length > 0 && (
        <p className="text-[13px] text-ink-muted">
          Arquivadas:{' '}
          {arquivadas.map((conta, i) => (
            <span key={conta.id}>
              {i > 0 && ', '}
              <button
                type="button"
                className="font-medium text-brand-text underline underline-offset-2"
                onClick={() => void arquivar(conta, true)}
              >
                reativar {conta.descricao}
              </button>
            </span>
          ))}
        </p>
      )}

      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nova conta fixa</DialogTitle>
            <DialogDescription>Algo que você paga todo mês fora do cartão.</DialogDescription>
          </DialogHeader>
          <FormularioDeConta
            categorias={dados.categorias}
            inicioPadrao={competencia}
            onSalvar={criar}
            rodape={
              <BotoesDoFormulario
                onCancelar={() => {
                  setCriando(false);
                }}
              />
            }
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEditando(null);
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editando?.descricao}</DialogTitle>
            <DialogDescription>O valor novo vale para os meses ainda não pagos.</DialogDescription>
          </DialogHeader>
          {editando && (
            <FormularioDeConta
              categorias={dados.categorias}
              inicial={editando}
              inicioPadrao={competencia}
              onSalvar={(conta) => salvar(editando, conta)}
              rodape={
                <BotoesDoFormulario
                  onCancelar={() => {
                    setEditando(null);
                  }}
                />
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pagando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPagando(null);
        }}
      >
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              Pagar {pagando?.conta.descricao} de {pagando ? mesCurto(pagando.competencia) : ''}
            </DialogTitle>
            <DialogDescription>
              Se o valor veio diferente neste mês, corrija aqui. Os próximos meses continuam com o
              valor de referência.
            </DialogDescription>
          </DialogHeader>
          {pagando && (
            <DialogPagar
              item={pagando}
              hoje={hoje}
              onFechar={() => {
                setPagando(null);
              }}
              onPagar={(valor, pagoEm) => pagar(pagando, valor, pagoEm)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
