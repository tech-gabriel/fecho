import { useEffect, useEffectEvent, useState } from 'react';
import { Check, Lock, MoreHorizontal } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Kbd } from '@/app/layout/apoio';
import { LogoSimbolo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  Conferencia,
  MetaDeEconomia,
  MovimentoDeEconomia,
  Preferencias,
  Receita,
} from '@/data';
import {
  assertCompetencia,
  competenciaDe,
  somarMeses,
  type Competencia,
} from '@/domain/competencia';
import { guardadoNoMes, metaDoMes } from '@/domain/economias';
import { parcelasTomadasDoMes } from '@/domain/emprestimos';
import { linhasPorDono } from '@/domain/faturas';
import { receitasDoMes, resumoDoMes } from '@/domain/resumo';
import { carregarFaturas, type FaturasCarregadas } from '@/features/alertas/faturas';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { montarFaturas } from '@/features/faturas/Faturas';
import { montarSituacoes } from '@/features/receber/situacoes';
import { acionar, emCampoDeTexto } from '@/lib/atalhos';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import { EtapaConferir, diferencasDaFatura } from './EtapaConferir';
import { EtapaEconomia, EtapaPagar, EtapaTerceiros } from './Etapas';
import type { ExtratoLido } from './lerExtrato';

interface Dados extends FaturasCarregadas {
  conferencias: Conferencia[];
  fechados: Competencia[];
  preferencias: Preferencias;
  metas: MetaDeEconomia[];
  movimentosDeEconomia: MovimentoDeEconomia[];
  receitas: Receita[];
}

const mesCurto = (c: Competencia) => nomeDoMes(c).split(' ')[0] ?? '';

function competenciaValida(texto: string | undefined): Competencia | null {
  try {
    return texto ? assertCompetencia(texto) : null;
  } catch {
    return null;
  }
}

export function FecharMes() {
  const competencia = competenciaValida(useParams().competencia);
  if (!competencia) return <Navigate to="/" replace />;
  return <Fechamento key={competencia} competencia={competencia} />;
}

function Fechamento({ competencia }: { competencia: Competencia }) {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const irParaCompetencia = useApp((s) => s.irParaCompetencia);
  const definirLegenda = useApp((s) => s.definirLegenda);
  const navigate = useNavigate();
  const [dados, setDados] = useState<Dados | null>(null);
  const [etapa, setEtapa] = useState<number | null>(null);
  const [extratos, setExtratos] = useState<ReadonlyMap<number, ExtratoLido>>(new Map());
  const hoje = hojeLocal();

  useEffect(() => {
    irParaCompetencia(competencia);
    definirLegenda(nomeDoMes(competencia));
    return () => {
      definirLegenda(null);
    };
  }, [competencia, irParaCompetencia, definirLegenda]);

  useEffect(() => {
    let montado = true;
    void Promise.all([
      carregarFaturas(repos, [competencia]),
      repos.fechamento.conferencias(),
      repos.fechamento.fechados(),
      repos.preferencias.ler(),
      repos.economias.metas.listar(),
      repos.economias.movimentos.listar(),
      repos.receitas.listar(),
    ]).then(
      ([
        carregadas,
        conferencias,
        fechados,
        preferencias,
        metas,
        movimentosDeEconomia,
        receitas,
      ]) => {
        if (!montado) return;
        setDados({
          ...carregadas,
          conferencias,
          fechados,
          preferencias,
          metas,
          movimentosDeEconomia,
          receitas,
        });
      },
    );
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao]);

  const salva =
    dados?.preferencias.etapaDoFechamento?.competencia === competencia
      ? dados.preferencias.etapaDoFechamento.etapa
      : 0;
  const atual = etapa ?? salva;

  const irPara = (proxima: number) => {
    setEtapa(proxima);
    void repos.preferencias.gravar({ etapaDoFechamento: { competencia, etapa: proxima } });
  };

  const fechar = () =>
    executar(async () => {
      await repos.fechamento.fechar(competencia, hoje);
      await repos.preferencias.gravar({ etapaDoFechamento: null });
      setEtapa(null);
      dadosMudaram();
      toast.success(`${mesCurto(competencia)} fechado`);
    });

  const proximo = () => {
    if (atual < 3) irPara(atual + 1);
    else void fechar();
  };
  const avancar = useEffectEvent(proximo);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        avancar();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey || emCampoDeTexto(e.target)) return;
      const emControle =
        e.target instanceof Element &&
        e.target.closest('button, a, [role="tab"], [role="checkbox"], [role="switch"]') !== null;
      const atalho =
        e.key === ' ' && !emControle
          ? 'conferir'
          : e.key.toLowerCase() === 'p'
            ? 'marcar-paga'
            : null;
      if (atalho && acionar(atalho)) e.preventDefault();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  if (!dados) return null;

  const parcelas = dados.porMes[0]?.parcelas ?? [];
  const faturas = montarFaturas({ ...dados, parcelas }, competencia, hoje).filter(
    (f) => f.resumo.total > 0,
  );
  // as parcelas carregadas vão só até o mês fechado; o corte mais tarde só faz contar os depósitos de hoje
  const corteDosDepositos = competenciaDe(hoje) > competencia ? competenciaDe(hoje) : competencia;
  const situacoes = montarSituacoes({
    ...dados,
    parcelas: dados.deTerceiros,
    competencia: corteDosDepositos,
    hoje,
  });
  const resumo = resumoDoMes({
    receitas: receitasDoMes(dados.receitas, competencia).map((r) => r.valorCentavos),
    linhas: linhasPorDono(parcelas),
    faturas: [],
    parcelasEmprestimos: parcelasTomadasDoMes(dados.tomados, competencia),
  });
  const guardado = guardadoNoMes(dados.movimentosDeEconomia, competencia);
  const meta = metaDoMes(dados.metas, competencia);
  const pagas = faturas.filter((f) => f.pagamento).length;
  const devendo = situacoes.filter((s) => s.falta > 0);

  if (dados.fechados.includes(competencia)) {
    return (
      <MesFechado
        competencia={competencia}
        pagas={pagas}
        totalPago={faturas.reduce((s, f) => s + (f.pagamento?.valorPagoCentavos ?? 0), 0)}
        aReceber={devendo.reduce((s, p) => s + p.falta, 0)}
        guardado={guardado}
        onReabrir={() =>
          void executar(async () => {
            await repos.fechamento.reabrir(competencia);
            dadosMudaram();
            toast.success(`${mesCurto(competencia)} reaberto`);
          })
        }
        onProximo={() => {
          irParaCompetencia(somarMeses(competencia, 1));
          void navigate('/');
        }}
      />
    );
  }

  const naoConferidas = faturas.filter(
    (f) =>
      !dados.conferencias.some((c) => c.cartaoId === f.cartao.id && c.competencia === competencia),
  );
  const paraResolver = naoConferidas.reduce(
    (soma, f) => soma + (diferencasDaFatura(f, extratos.get(f.cartao.id)) ?? 0),
    0,
  );
  const etapas = [
    {
      rotulo: 'Conferir faturas',
      legenda:
        naoConferidas.length === 0
          ? 'Tudo conferido'
          : paraResolver > 0
            ? `${String(paraResolver)} para resolver`
            : `${String(naoConferidas.length)} para conferir`,
    },
    { rotulo: 'Marcar como pagas', legenda: `${String(pagas)} de ${String(faturas.length)} pagas` },
    {
      rotulo: 'Terceiros',
      legenda: devendo.length === 0 ? 'Nada pendente' : `${String(devendo.length)} pendentes`,
    },
    { rotulo: 'Economia', legenda: meta === null ? 'Sem meta' : `Meta ${formatarMoeda(meta)}` },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="flex flex-col rounded-lg border bg-surface">
        <ol aria-label="Etapas do fechamento" className="flex items-start gap-2 border-b p-4">
          {etapas.map((e, i) => (
            <li key={e.rotulo} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                aria-current={i === atual ? 'step' : undefined}
                onClick={() => {
                  irPara(i);
                }}
                className="flex items-center gap-2 rounded-md p-1 text-left hover:bg-soft"
              >
                <span
                  className={cn(
                    'flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold',
                    i < atual && 'bg-brand text-on-brand',
                    i === atual && 'border-2 border-ink',
                    i > atual && 'border border-border-strong text-ink-muted',
                  )}
                >
                  {i < atual ? <Check size={14} strokeWidth={2} aria-hidden /> : i + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] leading-[18px] font-semibold">{e.rotulo}</span>
                  <span className="text-xs text-ink-muted">{e.legenda}</span>
                </span>
              </button>
              {i < etapas.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <section aria-label={etapas[atual]?.rotulo} className="p-6">
          {atual === 0 && (
            <EtapaConferir
              faturas={faturas}
              conferencias={dados.conferencias}
              extratos={extratos}
              onExtrato={(cartaoId, extrato) => {
                setExtratos((anteriores) => {
                  const novos = new Map(anteriores);
                  if (extrato) novos.set(cartaoId, extrato);
                  else novos.delete(cartaoId);
                  return novos;
                });
              }}
              hoje={hoje}
            />
          )}
          {atual === 1 && <EtapaPagar faturas={faturas} hoje={hoje} />}
          {atual === 2 && (
            <EtapaTerceiros
              situacoes={situacoes}
              preferencias={dados.preferencias}
              competencia={competencia}
              hoje={hoje}
            />
          )}
          {atual === 3 && (
            <EtapaEconomia
              competencia={competencia}
              hoje={hoje}
              guardado={guardado}
              meta={meta}
              entrou={resumo.renda}
              saiu={resumo.meusGastos}
              sobrou={resumo.saldoReal}
            />
          )}
        </section>

        <div className="flex items-center gap-3 border-t px-4 py-3">
          <Button
            variant="outline"
            disabled={atual === 0}
            onClick={() => {
              irPara(atual - 1);
            }}
          >
            Voltar
          </Button>
          <span className="flex-1 text-center text-xs text-ink-muted">
            Ctrl+Enter avança · você pode sair e continuar depois
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              void navigate('/');
            }}
          >
            Salvar e sair
          </Button>
          <Button aria-keyshortcuts="Control+Enter" className="font-semibold" onClick={proximo}>
            {atual < 3 ? 'Continuar' : `Fechar ${mesCurto(competencia)}`}
            <Kbd className="bg-on-brand/12 text-on-brand">Ctrl Enter</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MesFechado({
  competencia,
  pagas,
  totalPago,
  aReceber,
  guardado,
  onReabrir,
  onProximo,
}: {
  competencia: Competencia;
  pagas: number;
  totalPago: number;
  aReceber: number;
  guardado: number;
  onReabrir: () => void;
  onProximo: () => void;
}) {
  const mes = mesCurto(competencia);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <LogoSimbolo size={56} className="text-brand" />
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-bold">
          <Lock size={20} strokeWidth={1.75} aria-hidden />
          {mes} fechado
        </h2>
        <p className="max-w-md text-sm text-ink-muted">
          As compras das faturas de {mes} ficam só para leitura. Para mudar algo, reabra o mês no
          menu ⋯.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          {pagas === 1 ? '1 fatura paga' : `${String(pagas)} faturas pagas`} ·{' '}
          {formatarMoeda(totalPago)}
        </li>
        <li>
          {aReceber > 0
            ? `${formatarMoeda(aReceber)} ainda a receber de terceiros`
            : 'Ninguém ficou devendo'}
        </li>
        <li>Você guardou {formatarMoeda(guardado)}</li>
      </ul>
      <div className="flex items-center gap-2">
        <Button onClick={onProximo}>Ir para {mesCurto(somarMeses(competencia, 1))}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={`Mais ações de ${mes}`}>
              <MoreHorizontal strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onReabrir}>Reabrir {mes}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
