import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Plus,
  Scale,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import type {
  Assinatura,
  EmprestimoConcedido,
  EmprestimoTomado,
  Cartao,
  Movimento,
  PagamentoDeFatura,
  ParcelaDoMes,
  Preferencias,
  Receita,
  Terceiro,
} from '@/data';
import { projecaoDeAssinaturas } from '@/domain/assinaturas';
import { parcelasTomadasDoMes } from '@/domain/emprestimos';
import { somarMeses } from '@/domain/competencia';
import { linhasPorDono, resumoDaFatura } from '@/domain/faturas';
import { receitasDoMes, rendaComprometida, resumoDoMes } from '@/domain/resumo';
import { montarFaturas } from '@/features/faturas/Faturas';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { faltaNaFatura, montarSituacoes } from '@/features/receber/situacoes';
import { formatarComSinal, formatarMoeda, nomeDoMes } from '@/lib/formato';
import { DURACAO, MOVIMENTO, gsap, useGSAP } from '@/lib/gsap';
import { DialogRenda } from './DialogRenda';
import { GraficoComprometida } from './GraficoComprometida';
import { ProximosVencimentos } from './ProximosVencimentos';
import { useContagem } from './useContagem';

interface Dados {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  parcelas: ParcelaDoMes[];
  futuras: ParcelaDoMes[][];
  pagamentos: PagamentoDeFatura[];
  receitas: Receita[];
  preferencias: Preferencias;
  deTerceiros: ParcelaDoMes[];
  movimentos: Movimento[];
  assinaturas: Assinatura[];
  geradas: string[];
  tomados: EmprestimoTomado[];
  concedidos: EmprestimoConcedido[];
}

const MESES_DO_GRAFICO = 6;

function Valor({ centavos, sinal = false }: { centavos: number; sinal?: boolean }) {
  const exibido = useContagem(centavos);
  return <>{sinal ? formatarComSinal(exibido) : formatarMoeda(exibido)}</>;
}

function Kpi({
  rotulo,
  icone: Icone,
  corDoIcone,
  centavos,
  legenda,
  perigo = false,
  envolver,
}: {
  rotulo: string;
  icone: LucideIcon;
  corDoIcone: string;
  centavos: number;
  legenda: string;
  perigo?: boolean;
  envolver: (conteudo: ReactNode, classe: string) => ReactNode;
}) {
  return envolver(
    <>
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-muted">
        <Icone size={16} strokeWidth={1.75} aria-hidden className={corDoIcone} />
        {rotulo}
      </span>
      <span
        className={cn(
          'text-[32px] leading-9 font-bold tracking-[-0.02em] tabular-nums',
          perigo && 'text-danger-text',
        )}
      >
        <Valor centavos={centavos} sinal />
      </span>
      <span className="truncate text-xs text-ink-muted">{legenda}</span>
    </>,
    'cartao-do-dashboard flex flex-col gap-2 rounded-lg border bg-surface p-4 text-left hover:border-border-strong',
  );
}

const listaDeNomes = (nomes: string[]) =>
  nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1) ?? ''}`;

export function Dashboard() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const definirLegenda = useApp((s) => s.definirLegenda);
  const abrirNovaCompra = useApp((s) => s.abrirNovaCompra);
  const [dados, setDados] = useState<Dados | null>(null);
  const [rendaAberta, setRendaAberta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const hoje = hojeLocal();

  useEffect(() => {
    let montado = true;
    const seguintes = Array.from({ length: MESES_DO_GRAFICO }, (_, i) =>
      somarMeses(competencia, i + 1),
    );
    void Promise.all([
      repos.cartoes.listar(),
      repos.terceiros.listar(),
      repos.compras.parcelasDaCompetencia(competencia),
      Promise.all(seguintes.map((c) => repos.compras.parcelasDaCompetencia(c))),
      repos.faturas.pagamentos(),
      repos.receitas.listar(),
      repos.preferencias.ler(),
      repos.compras.parcelasDeTerceiros(competencia),
      repos.receber.movimentos(),
      repos.assinaturas.listar(),
      repos.assinaturas.geradas(),
      repos.emprestimos.tomados.listar(),
      repos.emprestimos.concedidos.listar(),
    ]).then(
      ([
        cartoes,
        terceiros,
        parcelas,
        futuras,
        pagamentos,
        receitas,
        preferencias,
        deTerceiros,
        movimentos,
        assinaturas,
        geradas,
        tomados,
        concedidos,
      ]) => {
        if (montado) {
          setDados({
            cartoes,
            terceiros,
            parcelas,
            futuras,
            pagamentos,
            receitas,
            preferencias,
            deTerceiros,
            movimentos,
            assinaturas,
            geradas,
            tomados,
            concedidos,
          });
        }
      },
    );
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao]);

  useEffect(() => {
    definirLegenda(nomeDoMes(competencia));
    return () => {
      definirLegenda(null);
    };
  }, [definirLegenda, competencia]);

  const carregado = dados !== null;
  useGSAP(
    () => {
      if (!carregado) return;
      gsap.matchMedia().add(MOVIMENTO, (contexto) => {
        const { reduzido } = contexto.conditions as { reduzido: boolean };
        gsap.from('.cartao-do-dashboard', {
          opacity: 0,
          y: reduzido ? 0 : 8,
          duration: reduzido ? DURACAO.micro : DURACAO.componente,
          stagger: reduzido ? 0 : 0.05,
          ease: 'power2.out',
        });
      });
    },
    { scope: raiz, dependencies: [carregado] },
  );

  if (!dados) return null;

  const faturas = montarFaturas(dados, competencia, hoje);
  const receitas = receitasDoMes(dados.receitas, competencia);
  const resumo = resumoDoMes({
    receitas: receitas.map((r) => r.valorCentavos),
    linhas: linhasPorDono(dados.parcelas),
    faturas: faturas.map((f) => ({
      total: f.resumo.total,
      vencimento: f.vencimento,
      paga: f.pagamento !== undefined,
    })),
    parcelasEmprestimos: parcelasTomadasDoMes(dados.tomados, competencia),
  });
  const comprometida = rendaComprometida(
    dados.futuras.map((parcelas, i) => {
      const mes = somarMeses(competencia, i + 1);
      return {
        competencia: mes,
        minhasParcelas: resumoDaFatura(linhasPorDono(parcelas)).meu,
        assinaturas: projecaoDeAssinaturas(
          dados.assinaturas,
          mes,
          new Set(dados.geradas),
          dados.cartoes,
        ),
        emprestimos: parcelasTomadasDoMes(dados.tomados, mes),
        renda: receitasDoMes(dados.receitas, mes).reduce((s, r) => s + r.valorCentavos, 0),
      };
    }),
  );

  const mes = nomeDoMes(competencia).split(' ')[0] ?? '';
  const situacoes = montarSituacoes({ ...dados, parcelas: dados.deTerceiros, competencia, hoje });
  const faltaDoMes = faturas
    .flatMap((f) => faltaNaFatura(situacoes, f.cartao.id, competencia))
    .reduce((soma, f) => soma + f.falta, 0);
  const depositadoDoMes = resumo.deTerceiros - faltaDoMes;
  const percentual =
    resumo.deTerceiros > 0 ? Math.round((depositadoDoMes / resumo.deTerceiros) * 100) : 0;
  const devedores = situacoes.filter((s) => s.falta > 0);
  const aReceber = devedores.reduce((soma, s) => soma + s.falta, 0);
  const temFaturas = faturas.some((f) => f.resumo.total > 0);
  const legendaDoCaixa = !temFaturas
    ? `Nenhuma fatura em ${mes}`
    : resumo.faturasAbertas === 0
      ? `Faturas de ${mes} pagas`
      : `para pagar ${resumo.faturasAbertas === 1 ? 'a fatura aberta' : `as ${resumo.faturasAbertas} faturas abertas`} de ${mes}`;

  if (!temFaturas && receitas.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-soft">
          <Plus size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
        </span>
        <p className="text-sm text-ink-muted">Nada lançado em {mes} ainda.</p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              abrirNovaCompra();
            }}
          >
            Registrar compra
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRendaAberta(true);
            }}
          >
            Cadastrar renda
          </Button>
        </div>
        <DialogRenda
          aberto={rendaAberta}
          competencia={competencia}
          receitas={dados.receitas}
          onFechar={() => {
            setRendaAberta(false);
          }}
          onMudou={dadosMudaram}
        />
      </div>
    );
  }

  const link = (para: string) => (conteudo: ReactNode, classe: string) => (
    <Link to={para} className={classe}>
      {conteudo}
    </Link>
  );

  return (
    <div ref={raiz} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid grid-cols-[minmax(340px,400px)_minmax(0,1fr)] gap-4">
        <section
          aria-labelledby="preciso-ter"
          className="cartao-do-dashboard flex flex-col gap-4 rounded-lg bg-brand p-6 text-on-brand"
        >
          <div className="flex items-center gap-2">
            <Wallet size={20} strokeWidth={1.75} aria-hidden />
            <h2 id="preciso-ter" className="flex-1 text-base font-semibold">
              Preciso ter em caixa
            </h2>
            {resumo.ultimoVencimento && (
              <span className="rounded-full bg-on-brand/12 px-2 text-xs font-semibold">
                até {dataCurta(resumo.ultimoVencimento)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[40px] leading-[44px] font-bold tracking-[-0.02em] tabular-nums">
              <Valor centavos={resumo.precisoTerEmCaixa} />
            </span>
            <span className="text-sm">{legendaDoCaixa}</span>
          </div>
          <div className="flex flex-col gap-1 border-t border-on-brand/20 pt-4">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <UserRound size={16} strokeWidth={1.75} aria-hidden />
              <span className="flex-1">Reembolso de terceiros</span>
              <span className="tabular-nums">{formatarMoeda(resumo.deTerceiros)}</span>
            </span>
            {resumo.deTerceiros > 0 ? (
              <>
                <div
                  role="progressbar"
                  aria-label="Reembolso já depositado"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentual}
                  className="my-1 h-2 overflow-hidden rounded-full bg-on-brand/15"
                >
                  <div
                    className="h-full rounded-full bg-on-brand"
                    style={{ width: `${String(percentual)}%` }}
                  />
                </div>
                <span className="text-[13px] tabular-nums">
                  {percentual}% · {formatarMoeda(depositadoDoMes)} de{' '}
                  {formatarMoeda(resumo.deTerceiros)} já depositados
                  {faltaDoMes > 0 && ` · faltam ${formatarMoeda(faltaDoMes)}`}
                </span>
              </>
            ) : (
              <span className="text-[13px]">Nenhuma compra de outras pessoas em {mes}</span>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <Kpi
            rotulo="Renda"
            icone={ArrowDownLeft}
            corDoIcone="text-success"
            centavos={resumo.renda}
            legenda={
              receitas.length > 0
                ? receitas.map((r) => r.descricao).join(' + ')
                : 'Toque para cadastrar sua renda'
            }
            envolver={(conteudo, classe) => (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setRendaAberta(true);
                }}
                className={classe}
              >
                {conteudo}
              </button>
            )}
          />
          <Kpi
            rotulo="Meus gastos"
            icone={ArrowUpRight}
            corDoIcone="text-ink-muted"
            centavos={resumo.meusGastos}
            legenda={
              resumo.renda > 0
                ? `${Math.round((resumo.meusGastos / resumo.renda) * 100)}% da renda · cartões e empréstimos`
                : 'cartões e empréstimos'
            }
            envolver={link('/lancamentos?ver=meu')}
          />
          <Kpi
            rotulo="Saldo real"
            icone={Scale}
            corDoIcone={resumo.saldoReal < 0 ? 'text-danger' : 'text-ink-muted'}
            centavos={resumo.saldoReal}
            perigo={resumo.saldoReal < 0}
            legenda="Renda menos os seus gastos"
            envolver={link('/lancamentos')}
          />
          <Kpi
            rotulo="A receber"
            icone={HandCoins}
            corDoIcone="text-info"
            centavos={aReceber}
            legenda={
              devedores.length > 0
                ? listaDeNomes(devedores.map((s) => s.terceiro.nome))
                : 'Ninguém te deve nada neste mês'
            }
            envolver={link('/receber')}
          />
        </div>
      </div>

      <div className="grid grid-cols-[1.15fr_1fr] gap-4">
        <div className="cartao-do-dashboard">
          <GraficoComprometida
            meses={comprometida}
            limite={dados.preferencias.limiteRendaComprometida}
          />
        </div>
        <div className="cartao-do-dashboard">
          <ProximosVencimentos
            faturas={faturas}
            situacoes={situacoes}
            preferencias={dados.preferencias}
            hoje={hoje}
          />
        </div>
      </div>

      <DialogRenda
        aberto={rendaAberta}
        competencia={competencia}
        receitas={dados.receitas}
        onFechar={() => {
          setRendaAberta(false);
        }}
        onMudou={dadosMudaram}
      />
    </div>
  );
}
