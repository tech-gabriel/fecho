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
): MudancaDeFatura[] {
  const faturaAberta = competenciaDaCompra(hoje, diaAntigo);

  return compras.flatMap((compra) => {
    const de = compra.parcelas.find((p) => p.numero === 1)?.competencia;
    if (!de || de < faturaAberta) return [];
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
