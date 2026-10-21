import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarClock, CircleCheck, CreditCard, HandCoins, Repeat } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import type { Assinatura, Cartao, Terceiro } from '@/data';
import type { FaturaParaAlerta } from '@/domain/alertas';
import { diasDaGrade, eventosDoPeriodo, type Evento } from '@/domain/calendario';
import {
  competenciaDe,
  dataNaCompetencia,
  somarDias,
  somarMeses,
  type Competencia,
  type DataLocal,
} from '@/domain/competencia';
import { datasDaFatura } from '@/domain/faturas';
import { carregarFaturas, faturasParaAlerta } from '@/features/alertas/faturas';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { diaPorExtenso, formatarMoeda, nomeDoMes } from '@/lib/formato';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_A_FRENTE = 20;
const MAXIMO_DE_CHIPS = 2;

interface Dados {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  assinaturas: Assinatura[];
  faturas: FaturaParaAlerta[];
}

const curto = (nome: string) => nome.replace(/^cartão\s+/i, '');

function textos(evento: Evento, dados: Dados) {
  const cartao = dados.cartoes.find((c) => c.id === evento.cartaoId);
  const nomeCartao = cartao?.nome ?? '';
  const valor = formatarMoeda(evento.valor ?? 0);
  switch (evento.tipo) {
    case 'fechamento': {
      const proxima = somarMeses(evento.competencia, 1);
      const vence = cartao ? datasDaFatura(proxima, cartao).vencimento : '';
      return {
        chip: `Fecha ${curto(nomeCartao)}`,
        titulo: `Fecha o ${nomeCartao}`,
        descricao: `Compras a partir de ${dataCurta(evento.data)} entram na fatura de ${nomeDoMes(proxima).split(' ')[0] ?? ''}, que vence em ${dataCurta(vence)}.`,
        valor: '',
      };
    }
    case 'vencimento': {
      const fatura = dados.faturas.find(
        (f) => f.cartaoId === evento.cartaoId && f.competencia === evento.competencia,
      );
      const faltas = (fatura?.faltaPorTerceiro ?? []).filter((f) => f.falta > 0);
      const pendencia =
        evento.status === 'paga' || faltas.length === 0
          ? ''
          : ` · faltam ${faltas
              .map(
                (f) =>
                  `${formatarMoeda(f.falta)} de ${dados.terceiros.find((t) => t.id === f.terceiroId)?.nome ?? ''}`,
              )
              .join(', ')}`;
      if (evento.status === 'paga') {
        return {
          chip: `${curto(nomeCartao)} pago`,
          titulo: `Fatura do ${nomeCartao} paga`,
          descricao: valor,
          valor,
        };
      }
      if (evento.status === 'atrasada') {
        return {
          chip: `${curto(nomeCartao)} atrasado`,
          titulo: `Fatura do ${nomeCartao} atrasada`,
          descricao: `${valor}${pendencia}`,
          valor,
        };
      }
      return {
        chip: `Vence ${curto(nomeCartao)}`,
        titulo: `Vence o ${nomeCartao}`,
        descricao: `${valor}${pendencia}`,
        valor,
      };
    }
    case 'reembolso': {
      const nome = dados.terceiros.find((t) => t.id === evento.terceiroId)?.nome ?? '';
      return {
        chip: `${nome} · ${valor}`,
        titulo: `${nome} ainda deve ${valor}`,
        descricao: `Da fatura do ${nomeCartao}, que venceu em ${dataCurta(evento.data)}.`,
        valor,
      };
    }
    case 'assinatura': {
      const nome = dados.assinaturas.find((a) => a.id === evento.assinaturaId)?.nome ?? '';
      return { chip: nome, titulo: nome, descricao: `${valor} no ${nomeCartao}`, valor };
    }
  }
}

function destino(evento: Evento): string {
  if (evento.tipo === 'assinatura') return '/assinaturas';
  if (evento.tipo === 'reembolso') return `/receber?pessoa=${String(evento.terceiroId)}`;
  return `/faturas?cartao=${String(evento.cartaoId)}`;
}

const atrasado = (e: Evento) => e.tipo === 'reembolso' || e.status === 'atrasada';

function Marcador({ evento, cor }: { evento: Evento; cor: string | undefined }) {
  if (evento.tipo === 'assinatura') {
    return <span aria-hidden className="size-1.5 flex-none rounded-[2px] bg-chart-3" />;
  }
  if (atrasado(evento)) {
    return <span aria-hidden className="size-1.5 flex-none rounded-full bg-danger" />;
  }
  return (
    <span
      aria-hidden
      style={{
        backgroundColor: cor,
        boxShadow:
          evento.tipo === 'fechamento'
            ? `0 0 0 1.5px var(--surface), 0 0 0 2.5px ${cor ?? 'currentColor'}`
            : undefined,
      }}
      className="size-1.5 flex-none rounded-full"
    />
  );
}

const ICONES = {
  fechamento: CreditCard,
  vencimento: CalendarClock,
  reembolso: HandCoins,
  assinatura: Repeat,
};

export function Calendario() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const definirLegenda = useApp((s) => s.definirLegenda);
  const irParaCompetencia = useApp((s) => s.irParaCompetencia);
  const [dados, setDados] = useState<Dados | null>(null);
  const hoje = hojeLocal();
  const inicial = (c: Competencia) => (competenciaDe(hoje) === c ? hoje : dataNaCompetencia(c, 1));
  const [escolha, setEscolha] = useState({ competencia, data: inicial(competencia) });
  const selecionado = escolha.competencia === competencia ? escolha.data : inicial(competencia);
  const celulas = useRef(new Map<DataLocal, HTMLButtonElement>());

  useEffect(() => {
    let montado = true;
    const atual = competenciaDe(hoje);
    const meses = [-1, 0, 1].flatMap((n) => [somarMeses(competencia, n), somarMeses(atual, n)]);
    void Promise.all([carregarFaturas(repos, meses), repos.assinaturas.listar()]).then(
      ([carregadas, assinaturas]) => {
        if (!montado) return;
        setDados({
          cartoes: carregadas.cartoes,
          terceiros: carregadas.terceiros,
          assinaturas,
          faturas: faturasParaAlerta(carregadas, hoje),
        });
      },
    );
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao, hoje]);

  useEffect(() => {
    definirLegenda(`${nomeDoMes(competencia)} · fechamentos, vencimentos e cobranças`);
    return () => {
      definirLegenda(null);
    };
  }, [definirLegenda, competencia]);

  if (!dados) return null;

  const dias = diasDaGrade(competencia);
  const doMes = dias.filter((d) => d.doMes);
  const eventos = eventosDoPeriodo({
    ...dados,
    de: doMes[0]?.data ?? '',
    ate: doMes.at(-1)?.data ?? '',
    hoje,
  });
  const proximos = eventosDoPeriodo({
    ...dados,
    de: hoje,
    ate: somarDias(hoje, DIAS_A_FRENTE - 1),
    hoje,
  }).filter((e) => e.tipo !== 'reembolso');
  const doDia = (data: DataLocal) => eventos.filter((e) => e.data === data);
  const corDoCartao = (id: number) => dados.cartoes.find((c) => c.id === id)?.cor;

  const escolher = (data: DataLocal, focar = false) => {
    if (competenciaDe(data) !== competencia) return;
    setEscolha({ competencia, data });
    if (focar) celulas.current.get(data)?.focus();
  };

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const indice = dias.findIndex((d) => d.data === selecionado);
    const coluna = indice % 7;
    const salto: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -coluna,
      End: 6 - coluna,
    };
    const passo = salto[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    const alvo = dias[indice + passo];
    if (alvo) escolher(alvo.data, true);
  };

  const doSelecionado = doDia(selecionado);
  const tituloDoDia =
    selecionado === hoje ? `Hoje, ${diaPorExtenso(selecionado)}` : diaPorExtenso(selecionado);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-4">
      <section
        aria-label={`Calendário de ${nomeDoMes(competencia)}`}
        className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-surface"
      >
        <div
          role="grid"
          aria-label={nomeDoMes(competencia)}
          tabIndex={-1}
          onKeyDown={aoTeclar}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div role="row" className="grid grid-cols-7 border-b">
            {SEMANA.map((dia) => (
              <span
                key={dia}
                role="columnheader"
                className="px-2 py-2 text-xs font-medium text-ink-muted"
              >
                {dia}
              </span>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr">
            {Array.from({ length: dias.length / 7 }, (_, semana) => (
              <div key={semana} role="row" className="grid grid-cols-7 border-b last:border-b-0">
                {dias.slice(semana * 7, semana * 7 + 7).map(({ data, doMes: noMes }, coluna) => {
                  const doDiaAtual = noMes ? doDia(data) : [];
                  const rotulos = doDiaAtual.map((e) => textos(e, dados).chip);
                  const selecionada = data === selecionado;
                  return (
                    <div
                      key={data}
                      role="gridcell"
                      aria-selected={noMes ? selecionada : undefined}
                      className={cn('min-w-0', coluna < 6 && 'border-r')}
                    >
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) celulas.current.set(data, el);
                          else celulas.current.delete(data);
                        }}
                        disabled={!noMes}
                        tabIndex={selecionada ? 0 : -1}
                        aria-label={[
                          data === hoje ? `Hoje, ${diaPorExtenso(data)}` : diaPorExtenso(data),
                          ...rotulos,
                        ].join(', ')}
                        onClick={() => {
                          escolher(data);
                        }}
                        className={cn(
                          'flex h-full min-h-20 w-full flex-col gap-0.5 p-1.5 text-left',
                          noMes ? 'hover:bg-soft' : 'cursor-default',
                          selecionada && 'bg-brand-subtle hover:bg-brand-subtle',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-[22px] min-w-[22px] items-center justify-center self-start rounded-full px-1 text-xs font-medium tabular-nums',
                            data === hoje && 'bg-brand font-bold text-on-brand',
                            !noMes && 'text-ink-muted opacity-50',
                          )}
                        >
                          {Number(data.slice(8))}
                        </span>
                        {doDiaAtual.slice(0, MAXIMO_DE_CHIPS).map((evento, i) => (
                          <span
                            key={`${evento.tipo}-${String(i)}`}
                            className={cn(
                              'flex min-w-0 items-center gap-1 rounded px-1 text-xs leading-4 font-medium',
                              atrasado(evento)
                                ? 'bg-danger-bg text-danger-text'
                                : 'bg-soft text-ink',
                              evento.status === 'paga' && 'opacity-70',
                            )}
                          >
                            <Marcador evento={evento} cor={corDoCartao(evento.cartaoId)} />
                            <span className="truncate">{rotulos[i]}</span>
                          </span>
                        ))}
                        {doDiaAtual.length > MAXIMO_DE_CHIPS && (
                          <span className="px-1 text-xs leading-4 text-ink-muted">
                            +{doDiaAtual.length - MAXIMO_DE_CHIPS}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <section
          aria-labelledby="dia-escolhido"
          className="flex flex-col gap-3 rounded-lg border bg-surface p-4"
        >
          <h2 id="dia-escolhido" className="text-base font-semibold">
            {tituloDoDia}
          </h2>
          {doSelecionado.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Nada marcado para este dia.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {doSelecionado.map((evento, i) => {
                const { titulo, descricao } = textos(evento, dados);
                const Icone =
                  evento.tipo === 'vencimento' && evento.status === 'paga'
                    ? CircleCheck
                    : ICONES[evento.tipo];
                return (
                  <li key={`${evento.tipo}-${String(i)}`}>
                    <Link
                      to={destino(evento)}
                      onClick={() => {
                        if (evento.tipo !== 'assinatura') irParaCompetencia(evento.competencia);
                      }}
                      className="flex items-start gap-3 rounded-md p-2 hover:bg-soft"
                    >
                      <span
                        className={cn(
                          'flex size-8 flex-none items-center justify-center rounded-md',
                          atrasado(evento) ? 'bg-danger-bg text-danger-text' : 'bg-soft text-ink',
                        )}
                      >
                        <Icone size={16} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">{titulo}</span>
                        <span className="text-[13px] text-ink-muted">{descricao}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="proximos-dias"
          className="flex flex-col gap-2 rounded-lg border bg-surface p-4"
        >
          <h2 id="proximos-dias" className="text-base font-semibold">
            Próximos {DIAS_A_FRENTE} dias
          </h2>
          {proximos.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Nada vence nos próximos {DIAS_A_FRENTE} dias.
            </p>
          ) : (
            <ul className="flex flex-col">
              {proximos.map((evento, i) => {
                const { titulo, valor } = textos(evento, dados);
                return (
                  <li
                    key={`${evento.data}-${evento.tipo}-${String(i)}`}
                    className="flex items-center gap-3 border-t py-2 text-[13px] first:border-t-0"
                  >
                    <span className="w-10 flex-none text-ink-muted tabular-nums">
                      {dataCurta(evento.data)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{titulo}</span>
                    <span className="font-medium tabular-nums">{valor}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
