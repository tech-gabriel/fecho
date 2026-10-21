import { CircleCheck, Clock, HandCoins, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';
import type { Cartao, EmprestimoConcedido, Movimento, ParcelaDoMes, Terceiro } from '@/data';
import { itemDoConcedido } from '@/domain/emprestimos';
import { dataNaCompetencia, type Competencia, type DataLocal } from '@/domain/competencia';
import { itensDaPessoa, situacaoDaPessoa } from '@/domain/receber';
import type { StatusTerceiro } from '@/domain/terceiros';

export type SituacaoDaPessoa = ReturnType<typeof situacaoDaPessoa> & {
  terceiro: Terceiro;
  depositos: Movimento[];
  cobrancas: Movimento[];
};

export function montarSituacoes({
  terceiros,
  cartoes,
  parcelas,
  movimentos,
  competencia,
  hoje,
  concedidos = [],
}: {
  concedidos?: EmprestimoConcedido[];
  terceiros: Terceiro[];
  cartoes: Cartao[];
  parcelas: ParcelaDoMes[];
  movimentos: Movimento[];
  competencia: Competencia;
  hoje: DataLocal;
}): SituacaoDaPessoa[] {
  const fimDoMes = dataNaCompetencia(competencia, 31);
  const ate = parcelas.filter((p) => p.competencia <= competencia);
  return terceiros.flatMap((terceiro) => {
    const itens = [
      ...itensDaPessoa(ate, terceiro.id, cartoes),
      ...concedidos
        .filter((c) => c.terceiroId === terceiro.id && c.data <= fimDoMes)
        .map(itemDoConcedido),
    ];
    const daPessoa = movimentos.filter((m) => m.terceiroId === terceiro.id && m.data <= fimDoMes);
    const depositos = daPessoa.filter((m) => m.tipo === 'deposito');
    if (!terceiro.ativo && itens.length === 0 && depositos.length === 0) return [];
    return [
      {
        ...situacaoDaPessoa(
          itens,
          depositos.map((d) => ({ valor: d.valorCentavos, abatimentos: d.abatimentos })),
          hoje,
        ),
        terceiro,
        depositos,
        cobrancas: daPessoa.filter((m) => m.tipo === 'cobranca'),
      },
    ];
  });
}

// ponytail: crédito sem compra marcada não abate a fatura; distribuir o crédito se isso confundir
export function faltaNaFatura(
  situacoes: SituacaoDaPessoa[],
  cartaoId: number,
  competencia: Competencia,
) {
  return situacoes.flatMap(({ terceiro, itens }) => {
    const falta = itens
      .filter((i) => i.cartaoId === cartaoId && i.competencia === competencia)
      .reduce((soma, i) => soma + i.aberto, 0);
    return falta > 0 ? [{ terceiro, falta }] : [];
  });
}

const STATUS: Record<
  StatusTerceiro,
  { rotulo: string; icone: typeof Clock; classe: string; cor: string }
> = {
  pago: {
    rotulo: 'Pago',
    icone: CircleCheck,
    classe: 'bg-success-bg text-success-text',
    cor: 'text-success',
  },
  pendente: {
    rotulo: 'Pendente',
    icone: Clock,
    classe: 'bg-warning-bg text-warning-text',
    cor: 'text-warning',
  },
  atrasado: {
    rotulo: 'Atrasado',
    icone: TriangleAlert,
    classe: 'bg-danger-bg text-danger-text',
    cor: 'text-danger',
  },
  parcial: {
    rotulo: 'Parcial',
    icone: HandCoins,
    classe: 'bg-info-bg text-info-text',
    cor: 'text-info',
  },
};

export function SeloDoTerceiro({ status }: { status: StatusTerceiro }) {
  const { rotulo, icone: Icone, classe, cor } = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap',
        classe,
      )}
    >
      <Icone size={12} strokeWidth={1.75} aria-hidden className={cor} />
      {rotulo}
    </span>
  );
}

export function Avatar({ nome, tamanho }: { nome: string; tamanho: 32 | 40 }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex flex-none items-center justify-center rounded-full bg-info-bg font-semibold text-info-text',
        tamanho === 32 ? 'size-8 text-sm' : 'size-10 text-base',
      )}
    >
      {nome.charAt(0).toUpperCase()}
    </span>
  );
}
