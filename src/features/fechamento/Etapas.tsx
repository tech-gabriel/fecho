import { entradaDeDinheiro } from '@/lib/entrada';
import { useId, useState } from 'react';
import { Check, CircleCheck, Copy, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Cartao, Preferencias } from '@/data';
import {
  type Competencia,
  type DataLocal,
  dataNaCompetencia,
  somarMeses,
} from '@/domain/competencia';
import { dataDoSaldo, saldoDaFatura } from '@/domain/fechamento';
import { lerReais } from '@/domain/money';
import { executar } from '@/features/cadastros/SecaoCadastro';
import type { FaturaDoCartao } from '@/features/faturas/Faturas';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { SeletorData } from '@/features/nova-compra/SeletorData';
import { useAcoesDeCobranca } from '@/features/receber/acoes';
import {
  Avatar,
  cartaoDaCobranca,
  contaDaCobranca,
  SeloDoTerceiro,
  type SituacaoDaPessoa,
} from '@/features/receber/situacoes';
import { formatarComSinal, formatarDecimal, formatarMoeda, nomeDoMes } from '@/lib/formato';

const mesCurto = (c: Competencia) => nomeDoMes(c).split(' ')[0] ?? '';

function emCentavos(texto: string): number | null {
  try {
    const centavos = lerReais(texto);
    return centavos >= 0 ? centavos : null;
  } catch {
    return null;
  }
}

function useDepois() {
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  return (mensagem: string, desfazer: () => Promise<void>) => {
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
}

export function EtapaPagar({ faturas, hoje }: { faturas: FaturaDoCartao[]; hoje: DataLocal }) {
  if (faturas.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-muted">Nenhuma fatura para pagar.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {faturas.map((f) => (
        <CardDePagamento key={f.cartao.id} fatura={f} hoje={hoje} />
      ))}
      <p className="text-[13px] text-ink-muted">
        Pagar menos que o total joga a diferença para a fatura de{' '}
        {mesCurto(somarMeses(faturas[0]?.competencia ?? '2000-01', 1))}. Os juros do banco entram
        quando você conferir o extrato de lá.
      </p>
    </div>
  );
}

function CardDePagamento({ fatura, hoje }: { fatura: FaturaDoCartao; hoje: DataLocal }) {
  const id = useId();
  const repos = useRepositorios();
  const depois = useDepois();
  const [valor, setValor] = useState(formatarDecimal(fatura.resumo.total));
  const [pagoEm, setPagoEm] = useState(hoje);
  const pago = emCentavos(valor);
  const { cartao, competencia } = fatura;

  const marcarPaga = () =>
    executar(async () => {
      if (pago === null) return;
      await repos.faturas.marcarComoPaga({
        cartaoId: cartao.id,
        competencia,
        pagoEm,
        valorPagoCentavos: pago,
      });
      const saldo = saldoDaFatura(fatura.resumo.total, pago);
      const saldoId =
        saldo > 0
          ? await repos.compras.salvar({
              cartaoId: cartao.id,
              descricao: `Saldo da fatura de ${mesCurto(competencia)}`,
              categoriaId: null,
              valorTotal: saldo,
              numParcelas: 1,
              dataCompra: dataDoSaldo(cartao, competencia),
              recorrente: false,
              rateios: [],
            })
          : null;
      depois(
        saldo > 0
          ? `Fatura paga. ${formatarMoeda(saldo)} foram para a fatura de ${mesCurto(somarMeses(competencia, 1))}.`
          : `Fatura do ${cartao.nome} marcada como paga`,
        async () => {
          if (saldoId !== null) await repos.compras.excluir(saldoId);
          await repos.faturas.desmarcar(cartao.id, competencia);
        },
      );
    });

  return (
    <section
      aria-label={`Fatura do ${cartao.nome}`}
      className="flex flex-wrap items-end gap-4 rounded-lg border p-4"
    >
      <div className="flex min-w-48 flex-1 items-center gap-3">
        <span
          aria-hidden
          style={{ backgroundColor: cartao.cor }}
          className="h-7 w-10 flex-none rounded-md"
        />
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{cartao.nome}</span>
          <span className="text-xs text-ink-muted">
            Vence {dataCurta(fatura.vencimento)} · {formatarMoeda(fatura.resumo.total)}
          </span>
        </span>
      </div>
      {fatura.pagamento ? (
        <span className="flex items-center gap-1 rounded-full bg-success-bg px-2 text-xs leading-5 font-medium text-success-text">
          <CircleCheck size={12} strokeWidth={1.75} aria-hidden />
          Paga em {dataCurta(fatura.pagamento.pagoEm)} ·{' '}
          {formatarMoeda(fatura.pagamento.valorPagoCentavos)}
        </span>
      ) : (
        <>
          <div className="flex w-36 flex-col gap-2">
            <Label htmlFor={`${id}-valor`}>Valor pago</Label>
            <Input
              id={`${id}-valor`}
              {...entradaDeDinheiro}
              value={valor}
              aria-invalid={pago === null ? true : undefined}
              onChange={(e) => {
                setValor(e.target.value);
              }}
              className="text-right tabular-nums"
            />
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor={`${id}-data`}>Pago em</Label>
            <SeletorData id={`${id}-data`} valor={pagoEm} hoje={hoje} onEscolher={setPagoEm} />
          </div>
          <Button
            disabled={pago === null}
            aria-keyshortcuts="P"
            data-atalho="marcar-paga"
            onClick={() => void marcarPaga()}
          >
            <Check strokeWidth={1.75} />
            Marcar paga
          </Button>
        </>
      )}
    </section>
  );
}

export function EtapaTerceiros({
  situacoes,
  cartoes,
  preferencias,
  competencia,
  hoje,
}: {
  situacoes: SituacaoDaPessoa[];
  cartoes: Cartao[];
  preferencias: Preferencias;
  competencia: Competencia;
  hoje: DataLocal;
}) {
  const { registrarDeposito, copiarCobranca } = useAcoesDeCobranca(preferencias, hoje);
  const devendo = situacoes.filter((s) => s.falta > 0);
  const total = devendo.reduce((soma, s) => soma + s.falta, 0);

  if (devendo.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-sm text-success-text">
        <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
        Ninguém deve nada de {mesCurto(competencia)}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Faltam <strong className="tabular-nums">{formatarMoeda(total)}</strong> de{' '}
        {devendo.length === 1 ? '1 pessoa' : `${String(devendo.length)} pessoas`}. Isso não impede
        de fechar: o que ficar aberto passa para o mês seguinte.
      </p>
      <ul className="flex flex-col rounded-lg border">
        {devendo.map((s) => {
          const abertos = s.itens.filter((i) => i.aberto > 0);
          return (
            <li
              key={s.terceiro.id}
              className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0"
            >
              <Avatar nome={s.terceiro.nome} tamanho={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.terceiro.nome}</span>
              <SeloDoTerceiro status={s.status} />
              <span className="w-28 text-right text-sm font-semibold tabular-nums">
                {formatarMoeda(s.falta)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void copiarCobranca(
                    s.terceiro,
                    {
                      valor: s.falta,
                      cartao: cartaoDaCobranca(s, cartoes),
                      conta: contaDaCobranca(s),
                      vencimento: s.prazo,
                    },
                    () => undefined,
                  )
                }
              >
                <Copy strokeWidth={1.75} />
                Copiar cobrança
              </Button>
              <Button
                size="sm"
                onClick={() => void registrarDeposito(s.terceiro, s.falta, abertos)}
              >
                <HandCoins strokeWidth={1.75} />
                Recebi
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EtapaEconomia({
  competencia,
  hoje,
  guardado,
  meta,
  entrou,
  saiu,
  sobrou,
}: {
  competencia: Competencia;
  hoje: DataLocal;
  guardado: number;
  meta: number | null;
  entrou: number;
  saiu: number;
  sobrou: number;
}) {
  const id = useId();
  const repos = useRepositorios();
  const depois = useDepois();
  const [valor, setValor] = useState(formatarDecimal(guardado));
  const novo = emCentavos(valor);
  const fimDoMes = dataNaCompetencia(competencia, 31);
  const proximo = mesCurto(somarMeses(competencia, 1));

  const salvar = () =>
    executar(async () => {
      if (novo === null || novo === guardado) return;
      const registro = await repos.economias.movimentos.criar({
        data: hoje < fimDoMes ? hoje : fimDoMes,
        valorCentavos: novo - guardado,
        objetivoId: null,
      });
      depois(`Economia de ${mesCurto(competencia)} atualizada`, () =>
        repos.economias.movimentos.excluir(registro),
      );
    });

  const mensagem =
    meta === null
      ? 'Sem meta definida para este mês.'
      : (novo ?? 0) >= meta
        ? 'Meta batida! Bom trabalho.'
        : `Faltaram ${formatarMoeda(meta - (novo ?? 0))}. Tudo bem, ${proximo} é outro mês.`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-6">
      <div className="flex flex-col gap-3">
        <Label htmlFor={`${id}-guardado`} className="text-base">
          Quanto você guardou em {mesCurto(competencia)}?
        </Label>
        <div className="flex h-16 items-center gap-2 rounded-md border border-border-strong px-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--focus-ring)">
          <span aria-hidden className="text-xl text-ink-muted">
            R$
          </span>
          <input
            id={`${id}-guardado`}
            {...entradaDeDinheiro}
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
            }}
            onBlur={() => void salvar()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey) void salvar();
            }}
            className="min-w-0 flex-1 bg-transparent text-[32px] leading-10 font-bold tabular-nums focus-visible:outline-none"
          />
        </div>
        {meta !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${String(Math.min(100, ((novo ?? 0) / meta) * 100))}%` }}
            />
          </div>
        )}
        <p role="status" className="text-[13px] text-ink-muted">
          {mensagem}
        </p>
      </div>
      <dl className="flex flex-col gap-3 rounded-lg bg-soft p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted-on-tint">Entrou</dt>
          <dd className="font-semibold tabular-nums">{formatarMoeda(entrou)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted-on-tint">Saiu (só o seu)</dt>
          <dd className="font-semibold tabular-nums">{formatarMoeda(saiu)}</dd>
        </div>
        <div className="flex justify-between border-t pt-3">
          <dt className="text-ink-muted-on-tint">Sobrou</dt>
          <dd className="font-semibold tabular-nums">{formatarComSinal(sobrou)}</dd>
        </div>
      </dl>
    </div>
  );
}
