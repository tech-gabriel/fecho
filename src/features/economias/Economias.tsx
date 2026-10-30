import { useEffect, useState } from 'react';
import { CircleCheck, MoreHorizontal, PiggyBank, Plus, Target, Trash2 } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  Rectangle,
  type RectangleProps,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  ContaFixa,
  EmprestimoTomado,
  PagamentoDeConta,
  MetaDeEconomia,
  MovimentoDeEconomia,
  Objetivo,
  ParcelaDoMes,
  Receita,
} from '@/data';
import { competenciaDe, legendaDoMes, type Competencia } from '@/domain/competencia';
import { contasDoMes, contasParaResumo } from '@/domain/contasFixas';
import {
  guardadoNoMes,
  historicoDeEconomia,
  metaDoMes,
  progressoDoObjetivo,
} from '@/domain/economias';
import { parcelasTomadasDoMes } from '@/domain/emprestimos';
import { linhasPorDono } from '@/domain/faturas';
import { somar } from '@/domain/money';
import { receitasDoMes, resumoDoMes } from '@/domain/resumo';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarComSinal, formatarMoeda, mesAbreviado, nomeDoMes } from '@/lib/formato';
import { DialogMeta, DialogObjetivo, DialogRegistrar } from './Dialogos';

interface Dados {
  metas: MetaDeEconomia[];
  objetivos: Objetivo[];
  movimentos: MovimentoDeEconomia[];
  receitas: Receita[];
  parcelas: ParcelaDoMes[];
  tomados: EmprestimoTomado[];
  contas: ContaFixa[];
  pagamentosDeConta: PagamentoDeConta[];
}

const mesCurto = (c: Competencia) => nomeDoMes(c).split(' ')[0] ?? '';

function fraseDaMeta(
  meta: number,
  guardado: number,
  sobra: number,
  competencia: Competencia,
  hoje: string,
) {
  if (guardado >= meta) {
    return guardado > meta
      ? `Meta batida! Você guardou ${formatarMoeda(guardado - meta)} a mais.`
      : 'Meta batida!';
  }
  const falta = meta - guardado;
  const legenda = legendaDoMes(competencia, hoje);
  if (legenda.tipo === 'passado' || legenda.tipo === 'fechado') {
    return `Faltaram ${formatarMoeda(falta)}.`;
  }
  if (legenda.tipo === 'futuro') return `Faltam ${formatarMoeda(falta)}.`;
  const ritmo = `Faltam ${formatarMoeda(falta)}. No ritmo de ${mesCurto(competencia)}, sobram ${formatarComSinal(sobra)} no fim do mês`;
  return sobra >= falta
    ? `${ritmo}, então dá para bater a meta.`
    : `${ritmo}, faltariam ${formatarMoeda(falta - Math.max(sobra, 0))} para a meta.`;
}

function prazoDoMes(competencia: Competencia, hoje: string) {
  const legenda = legendaDoMes(competencia, hoje);
  if (legenda.tipo === 'fechado') return 'Mês fechado';
  if (legenda.tipo === 'passado') return 'Mês encerrado';
  if (legenda.tipo === 'futuro') return 'Ainda não começou';
  return legenda.diasParaFechar === 0
    ? 'Último dia'
    : `Faltam ${String(legenda.diasParaFechar)} ${legenda.diasParaFechar === 1 ? 'dia' : 'dias'}`;
}

export function Economias() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const definirLegenda = useApp((s) => s.definirLegenda);
  const [dados, setDados] = useState<Dados | null>(null);
  const [aberto, setAberto] = useState<'registrar' | 'meta' | 'objetivo' | null>(null);
  const [editando, setEditando] = useState<Objetivo | null>(null);
  const hoje = hojeLocal();

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.economias.metas.listar(),
      repos.economias.objetivos.listar(),
      repos.economias.movimentos.listar(),
      repos.receitas.listar(),
      repos.compras.parcelasDaCompetencia(competencia),
      repos.emprestimos.tomados.listar(),
      repos.contasFixas.listar(),
      repos.contasFixas.pagamentos(),
    ]).then(
      ([metas, objetivos, movimentos, receitas, parcelas, tomados, contas, pagamentosDeConta]) => {
        if (montado)
          setDados({
            metas,
            objetivos,
            movimentos,
            receitas,
            parcelas,
            tomados,
            contas,
            pagamentosDeConta,
          });
      },
    );
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao]);

  const metaVigente = dados ? metaDoMes(dados.metas, competencia) : null;
  useEffect(() => {
    definirLegenda(
      metaVigente === null ? 'Sem meta definida' : `Meta de ${formatarMoeda(metaVigente)} por mês`,
    );
    return () => {
      definirLegenda(null);
    };
  }, [definirLegenda, metaVigente]);

  if (!dados) return null;

  const guardado = guardadoNoMes(dados.movimentos, competencia);
  const { saldoReal } = resumoDoMes({
    receitas: receitasDoMes(dados.receitas, competencia).map((r) => r.valorCentavos),
    linhas: linhasPorDono(dados.parcelas),
    faturas: [],
    parcelasEmprestimos: parcelasTomadasDoMes(dados.tomados, competencia),
    contas: contasParaResumo(
      contasDoMes(dados.contas, dados.pagamentosDeConta, competencia, hojeLocal()),
    ),
  });
  const historico = historicoDeEconomia(dados.movimentos, dados.metas, competencia);
  const total = somar(dados.movimentos.map((m) => m.valorCentavos));
  const doMes = dados.movimentos
    .filter((m) => competenciaDe(m.data) === competencia)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  const nomeDoObjetivo = (id: number | null) =>
    dados.objetivos.find((o) => o.id === id)?.nome ?? 'Sem objetivo';
  const batidos = historico.filter((h) => h.bateu).length;
  const comMeta = historico.filter((h) => h.meta !== null).length;

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

  const grafico = historico.map((h) => ({
    mes: mesAbreviado(h.competencia).mes,
    guardado: Math.max(h.guardado, 0) / 100,
    meta: h.meta === null ? null : h.meta / 100,
    marca: h.bateu ? '✓' : '',
    cor:
      h.competencia === competencia
        ? 'url(#hachura-mes-atual)'
        : h.bateu
          ? 'var(--chart-1)'
          : 'var(--chart-5)',
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setAberto('registrar');
          }}
        >
          <PiggyBank strokeWidth={1.75} />
          Registrar economia
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
        <section
          aria-labelledby="meta-do-mes"
          className="flex flex-col gap-3 rounded-lg border bg-surface p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="meta-do-mes" className="flex items-center gap-2 text-base font-semibold">
              <Target size={20} strokeWidth={1.75} aria-hidden />
              Meta de {mesCurto(competencia)}
            </h2>
            <span className="text-xs text-ink-muted">{prazoDoMes(competencia, hoje)}</span>
          </div>
          {metaVigente === null ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-ink-muted">
                Defina uma meta para acompanhar quanto você guarda por mês.
              </p>
              <Button
                onClick={() => {
                  setAberto('meta');
                }}
              >
                Definir meta
              </Button>
            </div>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-[32px] leading-10 font-bold tabular-nums">
                  {formatarComSinal(guardado)}
                </span>
                <span className="text-sm text-ink-muted">de {formatarMoeda(metaVigente)}</span>
              </p>
              <div
                role="progressbar"
                aria-label="Meta do mês"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(
                  100,
                  Math.max(0, Math.round((guardado / metaVigente) * 100)),
                )}
                className="h-2 overflow-hidden rounded-full bg-soft"
              >
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{
                    width: `${String(Math.min(100, Math.max(0, (guardado / metaVigente) * 100)))}%`,
                  }}
                />
              </div>
              <p className="text-[13px] text-ink-muted">
                {fraseDaMeta(metaVigente, guardado, saldoReal - guardado, competencia, hoje)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 self-start"
                onClick={() => {
                  setAberto('meta');
                }}
              >
                Mudar meta
              </Button>
            </>
          )}
        </section>

        <section
          aria-labelledby="total-guardado"
          className="flex flex-col gap-1 rounded-lg border bg-surface p-6"
        >
          <h2 id="total-guardado" className="text-sm text-ink-muted">
            Total guardado
          </h2>
          <span className="text-[28px] leading-[34px] font-bold tabular-nums">
            {formatarComSinal(total)}
          </span>
          <span className="text-xs text-ink-muted">
            {dados.objetivos.length === 1
              ? 'Em 1 objetivo'
              : `Em ${String(dados.objetivos.length)} objetivos`}
            {comMeta > 0 && ` · ${String(batidos)} de ${String(comMeta)} meses com a meta batida`}
          </span>
        </section>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
        <section
          aria-labelledby="quanto-guardou"
          className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
        >
          <div className="flex flex-col">
            <h2 id="quanto-guardou" className="text-base font-semibold">
              Quanto você guardou
            </h2>
            <p className="text-xs text-ink-muted">Últimos 12 meses · a linha tracejada é a meta</p>
          </div>
          <div aria-hidden className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={grafico} margin={{ top: 20, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <pattern
                    id="hachura-mes-atual"
                    width="6"
                    height="6"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="var(--chart-5)" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#FFB600" strokeWidth="3" />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v: number) => `R$ ${String(v)}`}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                />
                <Bar
                  dataKey="guardado"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  shape={(props: unknown) => {
                    const barra = props as RectangleProps & { payload: { cor: string } };
                    return <Rectangle {...barra} fill={barra.payload.cor} />;
                  }}
                >
                  <LabelList
                    dataKey="marca"
                    position="top"
                    fill="var(--success-text)"
                    fontSize={12}
                    fontWeight={700}
                  />
                </Bar>
                <Line
                  dataKey="meta"
                  type="stepAfter"
                  stroke="var(--ink-muted)"
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Quanto você guardou nos últimos 12 meses</caption>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Guardado</th>
                <th scope="col">Meta</th>
                <th scope="col">Bateu</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.competencia}>
                  <th scope="row">{nomeDoMes(h.competencia)}</th>
                  <td>{formatarComSinal(h.guardado)}</td>
                  <td>{h.meta === null ? 'sem meta' : formatarMoeda(h.meta)}</td>
                  <td>{h.bateu ? 'sim' : 'não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section
          aria-labelledby="objetivos"
          className="flex flex-col gap-3 rounded-lg border bg-surface p-6"
        >
          <div className="flex items-center justify-between">
            <h2 id="objetivos" className="text-base font-semibold">
              Objetivos
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-text"
              onClick={() => {
                setEditando(null);
                setAberto('objetivo');
              }}
            >
              <Plus strokeWidth={1.75} />
              Novo objetivo
            </Button>
          </div>
          {dados.objetivos.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Crie um objetivo para ver quanto falta para chegar lá.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {dados.objetivos.map((objetivo) => {
                const p = progressoDoObjetivo(objetivo, dados.movimentos, hoje);
                const legenda = p.concluido
                  ? `${formatarMoeda(p.guardado)} de ${formatarMoeda(objetivo.alvoCentavos)}`
                  : [
                      objetivo.prazo
                        ? `Para ${mesAbreviado(objetivo.prazo).mes} ${objetivo.prazo.slice(0, 4)}`
                        : 'Sem prazo',
                      `faltam ${formatarMoeda(p.falta)}`,
                      p.porMes === null ? null : `guarde ${formatarMoeda(p.porMes)} por mês`,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                return (
                  <li key={objetivo.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {objetivo.nome}
                      </span>
                      {p.concluido ? (
                        <span className="flex items-center gap-1 rounded-full bg-success-bg px-2 text-xs leading-5 font-medium text-success-text">
                          <CircleCheck size={12} strokeWidth={1.75} aria-hidden />
                          Concluído
                        </span>
                      ) : (
                        <span className="text-sm font-semibold tabular-nums">{p.percentual}%</span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Ações do objetivo ${objetivo.nome}`}
                          >
                            <MoreHorizontal strokeWidth={1.75} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditando(objetivo);
                              setAberto('objetivo');
                            }}
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-danger-text"
                            onSelect={() =>
                              void executar(async () => {
                                await repos.economias.objetivos.excluir(objetivo.id);
                                depois(`${objetivo.nome} excluído`, () =>
                                  repos.economias.objetivos.restaurar(objetivo.id),
                                );
                              })
                            }
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={objetivo.nome}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={p.percentual}
                      className="h-2 overflow-hidden rounded-full bg-soft"
                    >
                      <div
                        className="h-full rounded-full bg-chart-2"
                        style={{ width: `${String(p.percentual)}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-muted">{legenda}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section
        aria-labelledby="registros-do-mes"
        className="flex flex-col gap-2 rounded-lg border bg-surface p-6"
      >
        <h2 id="registros-do-mes" className="text-base font-semibold">
          Registros de {mesCurto(competencia)}
        </h2>
        {doMes.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nada registrado em {mesCurto(competencia)}.</p>
        ) : (
          <ul className="flex flex-col">
            {doMes.map((m) => (
              <li
                key={m.id}
                className="flex h-10 items-center gap-3 border-t text-[13px] first:border-t-0"
              >
                <span className="w-12 text-ink-muted tabular-nums">{dataCurta(m.data)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {m.valorCentavos < 0 ? 'Tirei' : 'Guardei'} · {nomeDoObjetivo(m.objetivoId)}
                </span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    m.valorCentavos < 0 ? 'text-danger-text' : 'text-success-text',
                  )}
                >
                  {m.valorCentavos > 0 ? '+' : ''}
                  {formatarComSinal(m.valorCentavos)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Excluir o registro de ${dataCurta(m.data)}`}
                  onClick={() =>
                    void executar(async () => {
                      await repos.economias.movimentos.excluir(m.id);
                      depois('Registro excluído', () => repos.economias.movimentos.restaurar(m.id));
                    })
                  }
                >
                  <Trash2 strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DialogRegistrar
        aberta={aberto === 'registrar'}
        objetivos={dados.objetivos}
        onFechar={() => {
          setAberto(null);
        }}
        onSalvar={async (registro) => {
          const id = await repos.economias.movimentos.criar(registro);
          setAberto(null);
          depois(
            registro.valorCentavos < 0
              ? `Retirada de ${formatarMoeda(-registro.valorCentavos)} registrada`
              : `${formatarMoeda(registro.valorCentavos)} guardados`,
            () => repos.economias.movimentos.excluir(id),
          );
        }}
      />
      <DialogMeta
        aberta={aberto === 'meta'}
        atual={metaVigente}
        competencia={competencia}
        onFechar={() => {
          setAberto(null);
        }}
        onSalvar={async (meta) => {
          await repos.economias.metas.definir(meta);
          setAberto(null);
          dadosMudaram();
          toast.success(
            `Meta de ${formatarMoeda(meta.valorCentavos)} a partir de ${nomeDoMes(meta.inicio)}`,
          );
        }}
      />
      <DialogObjetivo
        aberta={aberto === 'objetivo'}
        inicial={editando}
        onFechar={() => {
          setAberto(null);
          setEditando(null);
        }}
        onSalvar={async (objetivo) => {
          if (editando) {
            const anterior = editando;
            await repos.economias.objetivos.atualizar(anterior.id, objetivo);
            depois('Objetivo atualizado', () =>
              repos.economias.objetivos.atualizar(anterior.id, anterior),
            );
          } else {
            const id = await repos.economias.objetivos.criar(objetivo);
            depois(`${objetivo.nome} criado`, () => repos.economias.objetivos.excluir(id));
          }
          setAberto(null);
          setEditando(null);
        }}
      />
    </div>
  );
}
