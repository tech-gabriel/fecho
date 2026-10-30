import { useEffect, useRef, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from 'cn';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import type {
  Assinatura,
  Categoria,
  ContaFixa,
  PagamentoDeConta,
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
import { linhasPorDono, ordemDaCarteira, resumoDaFatura } from '@/domain/faturas';
import {
  contasDoMes,
  contasParaResumo,
  minhaParteDasContas,
  type ContaDoMes,
} from '@/domain/contasFixas';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { situacaoDoOrcamento } from '@/domain/orcamento';
import { receitasDoMes, rendaComprometida, resumoDoMes } from '@/domain/resumo';
import { montarFaturas } from '@/features/faturas/Faturas';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { montarSituacoes } from '@/features/receber/situacoes';
import { formatarComSinal, formatarMoeda, nomeDoMes } from '@/lib/formato';
import { DialogRenda } from './DialogRenda';
import { GraficoComprometida } from './GraficoComprometida';
import { Carteira } from './Carteira';
import { ForaDoCartao } from './ForaDoCartao';
import { Orcamento } from './Orcamento';
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
  categorias: Categoria[];
  contas: ContaFixa[];
  pagamentosDeConta: PagamentoDeConta[];
}

const MESES_DO_GRAFICO = 6;

function Valor({ centavos, sinal = false }: { centavos: number; sinal?: boolean }) {
  const exibido = useContagem(centavos);
  return <>{sinal ? formatarComSinal(exibido) : formatarMoeda(exibido)}</>;
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
      repos.categorias.listar(),
      repos.contasFixas.listar(),
      repos.contasFixas.pagamentos(),
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
        categorias,
        contas,
        pagamentosDeConta,
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
            categorias,
            contas,
            pagamentosDeConta,
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

  if (!dados) return null;

  const faturas = montarFaturas(dados, competencia, hoje);
  const receitas = receitasDoMes(dados.receitas, competencia);
  const contasDoMesAtual = contasDoMes(dados.contas, dados.pagamentosDeConta, competencia, hoje);
  const resumo = resumoDoMes({
    receitas: receitas.map((r) => r.valorCentavos),
    linhas: linhasPorDono(dados.parcelas),
    faturas: faturas.map((f) => ({
      total: f.resumo.total,
      vencimento: f.vencimento,
      paga: f.pagamento !== undefined,
    })),
    parcelasEmprestimos: parcelasTomadasDoMes(dados.tomados, competencia),
    contas: contasParaResumo(contasDoMesAtual),
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
        contas: minhaParteDasContas(contasDoMes(dados.contas, dados.pagamentosDeConta, mes, hoje)),
        emprestimos: parcelasTomadasDoMes(dados.tomados, mes),
        renda: receitasDoMes(dados.receitas, mes).reduce((s, r) => s + r.valorCentavos, 0),
      };
    }),
  );

  const mes = nomeDoMes(competencia).split(' ')[0] ?? '';
  const situacoes = montarSituacoes({
    ...dados,
    parcelas: dados.deTerceiros,
    competencia,
    hoje,
    contasFixas: { contas: dados.contas, pagamentos: dados.pagamentosDeConta },
  });
  const devedores = situacoes.filter((s) => s.falta > 0);
  const aReceber = devedores.reduce((soma, s) => soma + s.falta, 0);
  const temFaturas = faturas.some((f) => f.resumo.total > 0) || contasDoMesAtual.length > 0;
  if (!temFaturas && receitas.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-soft">
          <Plus size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
        </span>
        <p className="text-sm text-ink-muted-on-tint">Nada lançado em {mes} ainda.</p>
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

  const pagarConta = (item: ContaDoMes) =>
    executar(async () => {
      await repos.contasFixas.marcarPaga({
        contaId: item.conta.id,
        competencia: item.competencia,
        valorCentavos: item.valor,
        pagoEm: hoje,
      });
      dadosMudaram();
      toast.success(`${item.conta.descricao} marcada como paga`, {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void executar(async () => {
              await repos.contasFixas.desmarcar(item.conta.id, item.competencia);
              dadosMudaram();
            }),
        },
      });
    });

  const abertas = faturas.filter((f) => !f.pagamento && f.resumo.total > 0);
  const contasAbertas = contasDoMesAtual.filter((i) => !i.pagamento);
  const plural = (n: number, um: string, varios: string) => `${String(n)} ${n === 1 ? um : varios}`;
  const composicao = [
    abertas.length > 0 &&
      `${formatarMoeda(abertas.reduce((s, f) => s + f.resumo.total, 0))} em ${plural(abertas.length, 'fatura', 'faturas')}`,
    contasAbertas.length > 0 &&
      `${formatarMoeda(contasAbertas.reduce((s, i) => s + i.valor, 0))} em ${plural(contasAbertas.length, 'conta', 'contas')}`,
  ].filter(Boolean);
  const naCarteira = ordemDaCarteira(faturas.filter((f) => f.resumo.total > 0));
  const semFatura = faturas
    .filter((f) => f.resumo.total === 0 && f.cartao.ativo)
    .map((f) => f.cartao.nome);

  return (
    <div ref={raiz} className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto pb-6">
      <section
        aria-labelledby="preciso-ter"
        className="cartao-do-dashboard flex flex-wrap items-center justify-between gap-6 rounded-[10px] bg-brand-subtle px-8 py-7 ring-1 ring-brand/25"
      >
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-text">
            <Wallet size={16} strokeWidth={1.75} aria-hidden />
            <span id="preciso-ter">Preciso ter em caixa</span>
            {resumo.ultimoVencimento && (
              <span className="font-medium">até {dataCurta(resumo.ultimoVencimento)}</span>
            )}
          </p>
          <span className="text-[56px] leading-[60px] font-bold tracking-[-0.035em] tabular-nums">
            <Valor centavos={resumo.precisoTerEmCaixa} />
          </span>
          <p className="text-sm text-ink-muted-on-tint">
            {composicao.length > 0 ? `${composicao.join(' e ')}.` : `Tudo de ${mes} pago.`}
            {aReceber > 0 && (
              <>
                <br />
                <Link to="/receber" className="font-semibold text-brand-text hover:underline">
                  {formatarMoeda(aReceber)} voltam de{' '}
                  {listaDeNomes(devedores.map((s) => s.terceiro.nome))}.
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap divide-x divide-border rounded-lg bg-surface ring-1 ring-border">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setRendaAberta(true);
            }}
            className="flex flex-col items-start px-5 py-3 text-left first:rounded-l-lg last:rounded-r-lg hover:bg-soft"
          >
            <span className="text-xs text-ink-muted">Renda</span>
            <span className="text-lg font-semibold tabular-nums">
              {receitas.length > 0 ? formatarMoeda(resumo.renda) : 'Cadastrar'}
            </span>
          </button>
          <Link
            to="/lancamentos?ver=meu"
            className="flex flex-col px-5 py-3 first:rounded-l-lg last:rounded-r-lg hover:bg-soft"
          >
            <span className="text-xs text-ink-muted">
              Meus gastos
              {resumo.renda > 0 &&
                ` · ${String(Math.round((resumo.meusGastos / resumo.renda) * 100))}% da renda`}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {formatarMoeda(resumo.meusGastos)}
            </span>
          </Link>
          <Link
            to="/lancamentos"
            className="flex flex-col px-5 py-3 first:rounded-l-lg last:rounded-r-lg hover:bg-soft"
          >
            <span className="text-xs text-ink-muted">Saldo real</span>
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                resumo.saldoReal < 0 ? 'text-danger-text' : 'text-success-text',
              )}
            >
              <Valor centavos={resumo.saldoReal} sinal />
            </span>
          </Link>
        </div>
      </section>

      <Carteira
        mes={mes}
        faturas={naCarteira}
        semFatura={semFatura}
        terceiros={dados.terceiros}
        situacoes={situacoes}
        preferencias={dados.preferencias}
        hoje={hoje}
        onMudou={dadosMudaram}
        onRegistrar={() => {
          abrirNovaCompra();
        }}
      />

      <ForaDoCartao itens={contasDoMesAtual} onPagar={(item) => void pagarConta(item)} />

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5">
        <div className="cartao-do-dashboard">
          <GraficoComprometida
            meses={comprometida}
            limite={dados.preferencias.limiteRendaComprometida}
          />
        </div>
        <div className="cartao-do-dashboard">
          <Orcamento
            competencia={competencia}
            categorias={dados.categorias}
            situacoes={situacaoDoOrcamento(dados.categorias, dados.parcelas)}
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
