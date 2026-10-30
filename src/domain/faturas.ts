import { type Centavos } from './money';
import { type Rateio, ratear } from './terceiros';
import {
  type Competencia,
  type DataLocal,
  competenciaDe,
  dataNaCompetencia,
  diaDe,
  somarMeses,
  ultimoDia,
} from './competencia';

export interface DiasDoCartao {
  diaFechamento: number;
  diaVencimento: number;
}

function assertDiaDoMes(dia: number): number {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new RangeError(`Dia inválido: ${dia}`);
  return dia;
}

export function competenciaDaCompra(dataCompra: DataLocal, diaFechamento: number): Competencia {
  const mes = competenciaDe(dataCompra);
  const fechamento = Math.min(assertDiaDoMes(diaFechamento), ultimoDia(mes));
  return diaDe(dataCompra) < fechamento ? mes : somarMeses(mes, 1);
}

export function datasDaFatura(
  competencia: Competencia,
  { diaFechamento, diaVencimento }: DiasDoCartao,
): { fechamento: DataLocal; vencimento: DataLocal } {
  assertDiaDoMes(diaFechamento);
  assertDiaDoMes(diaVencimento);
  const mesDoVencimento = diaVencimento < diaFechamento ? somarMeses(competencia, 1) : competencia;
  return {
    fechamento: dataNaCompetencia(competencia, diaFechamento),
    vencimento: dataNaCompetencia(mesDoVencimento, diaVencimento),
  };
}

export interface ParcelaParaRecalculo {
  numero: number;
  competencia: Competencia;
}

export interface CompraParaRecalculo {
  compraId: number;
  descricao: string;
  dataCompra: DataLocal;
  parcelas: readonly ParcelaParaRecalculo[];
}

export interface MudancaDeFatura {
  compraId: number;
  descricao: string;
  de: Competencia;
  para: Competencia;
  parcelas: ParcelaParaRecalculo[];
}

function mesesEntre(de: Competencia, para: Competencia): number {
  const total = (c: Competencia) => Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7));
  return total(para) - total(de);
}

export function recalcularFechamento(
  compras: readonly CompraParaRecalculo[],
  diaAntigo: number,
  diaNovo: number,
  hoje: DataLocal,
  faturasPagas: readonly Competencia[] = [],
): MudancaDeFatura[] {
  const faturaAberta = competenciaDaCompra(hoje, diaAntigo);

  return compras.flatMap((compra) => {
    const de = compra.parcelas.find((p) => p.numero === 1)?.competencia;
    if (!de || de < faturaAberta || faturasPagas.includes(de)) return [];
    const para = competenciaDaCompra(compra.dataCompra, diaNovo);
    if (para === de) return [];
    const delta = mesesEntre(de, para);
    return [
      {
        compraId: compra.compraId,
        descricao: compra.descricao,
        de,
        para,
        parcelas: compra.parcelas.map((p) => ({
          numero: p.numero,
          competencia: somarMeses(p.competencia, delta),
        })),
      },
    ];
  });
}

export type StatusDaFatura = 'paga' | 'atrasada' | 'pendente';

export function statusDaFatura(
  fatura: { vencimento: DataLocal; pagoEm: DataLocal | null },
  hoje: DataLocal,
): StatusDaFatura {
  if (fatura.pagoEm) return 'paga';
  return hoje > fatura.vencimento ? 'atrasada' : 'pendente';
}

export interface LinhaDaFatura {
  parcelaId: number;
  dono: number | null;
  valorCentavos: Centavos;
}

export function linhasPorDono(
  parcelas: readonly { parcelaId: number; valorCentavos: Centavos; rateios: readonly Rateio[] }[],
): LinhaDaFatura[] {
  return parcelas.flatMap(({ parcelaId, valorCentavos, rateios }) => {
    const { meu, porTerceiro } = ratear(valorCentavos, rateios);
    const minhas = meu > 0 ? [{ parcelaId, dono: null, valorCentavos: meu }] : [];
    return [
      ...minhas,
      ...[...porTerceiro].map(([dono, valor]) => ({ parcelaId, dono, valorCentavos: valor })),
    ];
  });
}

export function resumoDaFatura(linhas: readonly LinhaDaFatura[]): {
  total: Centavos;
  meu: Centavos;
  porTerceiro: Map<number, Centavos>;
} {
  const porTerceiro = new Map<number, Centavos>();
  let meu = 0;
  for (const { dono, valorCentavos } of linhas) {
    if (dono === null) meu += valorCentavos;
    else porTerceiro.set(dono, (porTerceiro.get(dono) ?? 0) + valorCentavos);
  }
  const total = meu + [...porTerceiro.values()].reduce((a, b) => a + b, 0);
  return { total, meu, porTerceiro };
}

const PRIORIDADE: Record<StatusDaFatura, number> = { atrasada: 0, pendente: 1, paga: 2 };

export function ordemDaCarteira<T extends { status: StatusDaFatura; vencimento: DataLocal }>(
  itens: readonly T[],
): T[] {
  return [...itens].sort(
    (a, b) =>
      PRIORIDADE[a.status] - PRIORIDADE[b.status] || a.vencimento.localeCompare(b.vencimento),
  );
}
