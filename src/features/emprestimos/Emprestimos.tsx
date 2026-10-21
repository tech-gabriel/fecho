import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Check,
  CircleCheck,
  Clock,
  Info,
  Landmark,
  MoreHorizontal,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { cn } from 'cn';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type {
  EmprestimoConcedido,
  EmprestimoTomado,
  Movimento,
  PagamentoDeParcela,
  Terceiro,
} from '@/data';
import { type DataLocal } from '@/domain/competencia';
import {
  parcelasDoTomado,
  resumoDoTomado,
  type ParcelaTomada,
  type StatusDaParcela,
} from '@/domain/emprestimos';
import { somar } from '@/domain/money';
import { statusTerceiro } from '@/domain/terceiros';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { SeloDoTerceiro } from '@/features/receber/situacoes';
import { formatarMoeda } from '@/lib/formato';
import { FormularioConcedido, FormularioTomado } from './FormularioDeEmprestimo';

interface Dados {
  tomados: EmprestimoTomado[];
  concedidos: EmprestimoConcedido[];
  pagamentos: PagamentoDeParcela[];
  terceiros: Terceiro[];
  movimentos: Movimento[];
}

type Edicao =
  { tipo: 'tomado'; item: EmprestimoTomado } | { tipo: 'concedido'; item: EmprestimoConcedido };

const dataCompleta = (data: DataLocal) =>
  `${data.slice(8)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

const STATUS: Record<StatusDaParcela, { rotulo: string; icone: typeof Clock; classe: string }> = {
  paga: { rotulo: 'Paga', icone: CircleCheck, classe: 'bg-success-bg text-success-text' },
  atrasada: { rotulo: 'Atrasada', icone: TriangleAlert, classe: 'bg-danger-bg text-danger-text' },
  pendente: { rotulo: 'Pendente', icone: Clock, classe: 'bg-warning-bg text-warning-text' },
  prevista: { rotulo: 'Prevista', icone: CalendarClock, classe: 'bg-soft text-ink-muted-on-tint' },
};

function SeloDaParcela({ parcela }: { parcela: ParcelaTomada }) {
  const { rotulo, icone: Icone, classe } = STATUS[parcela.status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 text-xs leading-5 font-medium',
        classe,
      )}
    >
      <Icone size={12} strokeWidth={1.75} aria-hidden />
      {parcela.pagoEm ? `Paga em ${dataCurta(parcela.pagoEm)}` : rotulo}
    </span>
  );
}

export function Emprestimos() {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [dados, setDados] = useState<Dados | null>(null);
  const [criando, setCriando] = useState<'tomado' | 'concedido' | null>(null);
  const [editando, setEditando] = useState<Edicao | null>(null);
  const hoje = hojeLocal();

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.emprestimos.tomados.listar(),
      repos.emprestimos.concedidos.listar(),
      repos.emprestimos.pagamentos(),
      repos.terceiros.listar(),
      repos.receber.movimentos(),
    ]).then(([tomados, concedidos, pagamentos, terceiros, movimentos]) => {
      if (montado) setDados({ tomados, concedidos, pagamentos, terceiros, movimentos });
    });
    return () => {
      montado = false;
    };
  }, [repos, versao]);

  if (!dados) return null;

  const tomados = dados.tomados.map((emprestimo) => {
    const parcelas = parcelasDoTomado(emprestimo, dados.pagamentos, hoje);
    return { emprestimo, parcelas, resumo: resumoDoTomado(emprestimo, parcelas) };
  });
  const ativos = tomados.filter((t) => !t.resumo.quitado);
  const quitados = tomados.filter((t) => t.resumo.quitado);
  const nomeDe = (id: number) => dados.terceiros.find((t) => t.id === id)?.nome ?? '';
  const abatidoDe = (id: number) =>
    somar(
      dados.movimentos.flatMap((m) =>
        m.abatimentos.flatMap((a) =>
          'emprestimoId' in a && a.emprestimoId === id ? [a.valor] : [],
        ),
      ),
    );

  const depois = (mensagem: string, desfazer: () => Promise<void>) => {
    dadosMudaram();
    toast.success(mensagem, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await desfazer();
            dadosMudaram();
          }),
      },
    });
  };

  const marcarPaga = (emprestimo: EmprestimoTomado, numero: number) =>
    executar(async () => {
      await repos.emprestimos.marcarPaga({ emprestimoId: emprestimo.id, numero, pagoEm: hoje });
      depois(`${String(numero)}ª parcela marcada como paga`, () =>
        repos.emprestimos.desmarcar(emprestimo.id, numero),
      );
    });

  const excluir = (edicao: Edicao) =>
    executar(async () => {
      const cadastro =
        edicao.tipo === 'tomado' ? repos.emprestimos.tomados : repos.emprestimos.concedidos;
      await cadastro.excluir(edicao.item.id);
      setEditando(null);
      depois('Empréstimo excluído', () => cadastro.restaurar(edicao.item.id));
    });

  const vazio = dados.tomados.length === 0 && dados.concedidos.length === 0;
  const novo = (
    <Button
      variant="outline"
      onClick={() => {
        setCriando('tomado');
      }}
    >
      <Plus strokeWidth={2} />
      Novo empréstimo
    </Button>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-4 overflow-y-auto pb-6">
      <div className="flex min-w-0 flex-col gap-4">
        {vazio ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-surface px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-soft">
              <Landmark
                size={24}
                strokeWidth={1.75}
                aria-hidden
                className="text-ink-muted-on-tint"
              />
            </span>
            <p className="text-sm text-ink-muted">Nenhum empréstimo por aqui.</p>
            {novo}
          </div>
        ) : ativos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-surface px-6 py-12 text-center">
            <p className="text-sm text-ink-muted">Você não está pagando nenhum empréstimo.</p>
            {novo}
          </div>
        ) : (
          ativos.map(({ emprestimo, parcelas, resumo }) => (
            <CardDoTomado
              key={emprestimo.id}
              emprestimo={emprestimo}
              parcelas={parcelas}
              resumo={resumo}
              onMarcarPaga={(numero) => void marcarPaga(emprestimo, numero)}
              onEditar={() => {
                setEditando({ tipo: 'tomado', item: emprestimo });
              }}
              onExcluir={() => void excluir({ tipo: 'tomado', item: emprestimo })}
            />
          ))
        )}
      </div>

      <aside className="flex flex-col gap-4">
        {!vazio && <div className="flex justify-end">{novo}</div>}
        <section
          aria-labelledby="total-que-deve"
          className="flex flex-col gap-1 rounded-lg border bg-surface p-4"
        >
          <h2 id="total-que-deve" className="text-sm text-ink-muted">
            Total que você deve
          </h2>
          <span className="text-[28px] leading-[34px] font-bold tabular-nums">
            {formatarMoeda(somar(ativos.map((t) => t.resumo.faltaPagar)))}
          </span>
          <span className="text-xs text-ink-muted">
            {ativos.length === 1 ? '1 empréstimo' : `${String(ativos.length)} empréstimos`} em
            andamento
          </span>
        </section>

        <section
          aria-labelledby="voce-emprestou"
          className="flex flex-col gap-2 rounded-lg border bg-surface p-4"
        >
          <div className="flex items-center justify-between">
            <h2 id="voce-emprestou" className="text-base font-semibold">
              Você emprestou
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCriando('concedido');
              }}
            >
              <Plus strokeWidth={1.75} />
              Emprestar
            </Button>
          </div>
          {dados.concedidos.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Ninguém está te devendo um empréstimo.</p>
          ) : (
            <ul className="flex flex-col">
              {dados.concedidos.map((c) => {
                const abatido = abatidoDe(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 border-t py-2 text-[13px] first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {nomeDe(c.terceiroId)} · {formatarMoeda(c.valorCentavos)}
                      </span>
                      <span className="text-xs text-ink-muted">
                        Devolve até {dataCurta(c.prazo)}
                        {abatido > 0 && ` · já devolveu ${formatarMoeda(abatido)}`}
                      </span>
                    </span>
                    <SeloDoTerceiro
                      status={statusTerceiro({
                        devido: c.valorCentavos,
                        depositado: abatido,
                        prazo: c.prazo,
                        hoje,
                      })}
                    />
                    <Mais
                      rotulo={`Ações do empréstimo para ${nomeDe(c.terceiroId)}`}
                      onEditar={() => {
                        setEditando({ tipo: 'concedido', item: c });
                      }}
                      onExcluir={() => void excluir({ tipo: 'concedido', item: c })}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {quitados.length > 0 && (
          <details className="group rounded-lg border bg-surface p-4">
            <summary className="cursor-pointer text-base font-semibold">
              Já quitados ({quitados.length})
            </summary>
            <ul className="mt-2 flex flex-col">
              {quitados.map(({ emprestimo, resumo }) => (
                <li
                  key={emprestimo.id}
                  className="flex items-center justify-between border-t py-2 text-[13px] first:border-t-0"
                >
                  <span className="truncate">{emprestimo.descricao}</span>
                  <span className="text-ink-muted tabular-nums">
                    {formatarMoeda(resumo.totalAPagar)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-[13px] text-info-text">
          <Info size={16} strokeWidth={1.75} aria-hidden className="mt-px flex-none" />
          <span>
            O que os outros te devem, inclusive empréstimos, fica em{' '}
            <Link to="/receber" className="font-medium underline">
              A receber
            </Link>
            .
          </span>
        </p>
      </aside>

      <Dialog
        open={criando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setCriando(null);
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Novo empréstimo</DialogTitle>
            <DialogDescription className="sr-only">
              Registre um empréstimo que você pegou ou que você deu.
            </DialogDescription>
          </DialogHeader>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Tipo de empréstimo"
            value={criando ?? 'tomado'}
            onValueChange={(valor) => {
              if (valor) setCriando(valor as 'tomado' | 'concedido');
            }}
            className="w-full"
          >
            {(
              [
                ['tomado', 'Peguei'],
                ['concedido', 'Emprestei'],
              ] as const
            ).map(([valor, rotulo]) => (
              <ToggleGroupItem
                key={valor}
                value={valor}
                className="flex-1 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
              >
                {rotulo}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {criando === 'tomado' && (
            <FormularioTomado
              onCancelar={() => {
                setCriando(null);
              }}
              onSalvar={async (novo) => {
                const id = await repos.emprestimos.tomados.criar(novo);
                setCriando(null);
                depois(`${novo.descricao} registrado`, () => repos.emprestimos.tomados.excluir(id));
              }}
            />
          )}
          {criando === 'concedido' && (
            <FormularioConcedido
              terceiros={dados.terceiros.filter((t) => t.ativo)}
              onCancelar={() => {
                setCriando(null);
              }}
              onSalvar={async (novo) => {
                const id = await repos.emprestimos.concedidos.criar(novo);
                setCriando(null);
                depois(`Empréstimo para ${nomeDe(novo.terceiroId)} registrado`, () =>
                  repos.emprestimos.concedidos.excluir(id),
                );
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEditando(null);
        }}
      >
        <SheetContent className="w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar empréstimo</SheetTitle>
            <SheetDescription>
              {editando?.tipo === 'concedido'
                ? `Para ${nomeDe(editando.item.terceiroId)}`
                : editando?.item.descricao}
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            {editando?.tipo === 'tomado' && (
              <FormularioTomado
                inicial={editando.item}
                onCancelar={() => {
                  setEditando(null);
                }}
                onSalvar={async (alterado) => {
                  const anterior = editando.item;
                  await repos.emprestimos.tomados.atualizar(anterior.id, alterado);
                  setEditando(null);
                  depois('Empréstimo atualizado', () =>
                    repos.emprestimos.tomados.atualizar(anterior.id, anterior),
                  );
                }}
              />
            )}
            {editando?.tipo === 'concedido' && (
              <FormularioConcedido
                terceiros={dados.terceiros.filter(
                  (t) => t.ativo || t.id === editando.item.terceiroId,
                )}
                inicial={editando.item}
                onCancelar={() => {
                  setEditando(null);
                }}
                onSalvar={async (alterado) => {
                  const anterior = editando.item;
                  await repos.emprestimos.concedidos.atualizar(anterior.id, alterado);
                  setEditando(null);
                  depois('Empréstimo atualizado', () =>
                    repos.emprestimos.concedidos.atualizar(anterior.id, anterior),
                  );
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Mais({
  rotulo,
  onEditar,
  onExcluir,
}: {
  rotulo: string;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={rotulo}>
          <MoreHorizontal strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditar}>Editar</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExcluir} className="text-danger-text">
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CardDoTomado({
  emprestimo,
  parcelas,
  resumo,
  onMarcarPaga,
  onEditar,
  onExcluir,
}: {
  emprestimo: EmprestimoTomado;
  parcelas: ParcelaTomada[];
  resumo: ReturnType<typeof resumoDoTomado>;
  onMarcarPaga: (numero: number) => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const { proxima } = resumo;
  const idTitulo = `emprestimo-${String(emprestimo.id)}`;
  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-md bg-soft">
          <Landmark size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={idTitulo} className="text-base font-semibold">
            {emprestimo.descricao}
          </h2>
          <p className="text-[13px] text-ink-muted">
            Pego em {dataCompleta(emprestimo.data)} · {emprestimo.numParcelas} parcelas de{' '}
            {formatarMoeda(emprestimo.valorParcelaCentavos)} · debitadas no dia {emprestimo.dia}
          </p>
        </div>
        {proxima && (
          <span
            className={cn(
              'rounded-full px-2 text-xs leading-5 font-medium',
              proxima.status === 'atrasada'
                ? 'bg-danger-bg text-danger-text'
                : 'bg-brand-subtle text-brand-text',
            )}
          >
            {proxima.numero}ª {proxima.status === 'atrasada' ? 'venceu' : 'vence'}{' '}
            {dataCurta(proxima.vencimento)}
          </span>
        )}
        <Mais
          rotulo={`Ações do ${emprestimo.descricao}`}
          onEditar={onEditar}
          onExcluir={onExcluir}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Tile rotulo="Ainda falta pagar" valor={formatarMoeda(resumo.faltaPagar)} />
        <Tile rotulo="Você pegou" valor={formatarMoeda(resumo.pegou)} />
        <Tile
          rotulo="Juros no total"
          valor={formatarMoeda(resumo.juros)}
          legenda={`Vai pagar ${formatarMoeda(resumo.totalAPagar)} ao todo`}
        />
      </div>

      <div
        role="img"
        aria-label={`${String(resumo.pagas)} de ${String(parcelas.length)} parcelas pagas`}
        className="flex h-2 gap-1"
      >
        {parcelas.map((p) => (
          <span
            key={p.numero}
            className={cn(
              'flex-1 rounded-sm',
              p.status === 'paga'
                ? 'bg-chart-1'
                : p.numero === proxima?.numero
                  ? 'outline-2 -outline-offset-2 outline-brand-text'
                  : 'bg-soft',
            )}
          />
        ))}
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="h-9 border-b text-left text-xs text-ink-muted">
            <th scope="col" className="font-medium">
              Parcela
            </th>
            <th scope="col" className="font-medium">
              Vencimento
            </th>
            <th scope="col" className="text-right font-medium">
              Valor
            </th>
            <th scope="col" className="pl-6 font-medium">
              Status
            </th>
            <th scope="col" className="sr-only">
              Ação
            </th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p) => (
            <tr key={p.numero} className="h-10 border-b last:border-b-0">
              <td className="tabular-nums">
                {p.numero}/{parcelas.length}
              </td>
              <td className="text-ink-muted tabular-nums">{dataCompleta(p.vencimento)}</td>
              <td className="text-right font-medium tabular-nums">{formatarMoeda(p.valor)}</td>
              <td className="pl-6">
                <SeloDaParcela parcela={p} />
              </td>
              <td className="text-right">
                {p.status !== 'paga' && p.status !== 'prevista' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    aria-label={`Marcar a parcela ${String(p.numero)} como paga`}
                    onClick={() => {
                      onMarcarPaga(p.numero);
                    }}
                  >
                    <Check strokeWidth={1.75} />
                    Marcar paga
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Tile({ rotulo, valor, legenda }: { rotulo: string; valor: string; legenda?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-soft px-4 py-3">
      <span className="text-xs text-ink-muted-on-tint">{rotulo}</span>
      <span className="text-xl leading-7 font-bold tabular-nums">{valor}</span>
      {legenda && <span className="text-xs text-ink-muted-on-tint">{legenda}</span>}
    </div>
  );
}
