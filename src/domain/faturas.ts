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
