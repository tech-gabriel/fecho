import type { DataLocal } from './competencia';
import type { Centavos } from './money';

export interface Taxas {
  cdi: number;
  selic: number;
  poupancaMensal: number;
  data: DataLocal;
}

export type TipoDeRendimento = 'poupanca' | 'cdi' | 'selic' | 'fixa';

export const anualDaPoupanca = (mensalPct: number) => ((1 + mensalPct / 100) ** 12 - 1) * 100;

export function aliquotaDoIr(meses: number): number {
  if (meses <= 6) return 22.5;
  if (meses <= 12) return 20;
  if (meses <= 24) return 17.5;
  return 15;
}

export function rendimentoDe(
  tipo: TipoDeRendimento,
  taxas: Taxas | null,
  percentualDoCdi: number,
  taxaFixa: number,
): number | null {
  if (tipo === 'fixa') return taxaFixa;
  if (!taxas) return null;
  if (tipo === 'cdi') return (taxas.cdi * percentualDoCdi) / 100;
  if (tipo === 'selic') return taxas.selic;
  return anualDaPoupanca(taxas.poupancaMensal);
}

export function simular(entrada: {
  inicial: Centavos;
  mensal: Centavos;
  taxaAnualPct: number;
  meses: number;
  ir: boolean;
}) {
  const i = (1 + entrada.taxaAnualPct / 100) ** (1 / 12) - 1;
  const meses = [{ mes: 0, investido: entrada.inicial, saldo: entrada.inicial }];
  let saldo = entrada.inicial;
  let investido = entrada.inicial;
  for (let mes = 1; mes <= entrada.meses; mes++) {
    saldo = Math.round(saldo * (1 + i)) + entrada.mensal;
    investido += entrada.mensal;
    meses.push({ mes, investido, saldo });
  }
  const rendimento = saldo - investido;
  const aliquota = entrada.ir ? aliquotaDoIr(entrada.meses) : 0;
  const imposto = Math.round((Math.max(rendimento, 0) * aliquota) / 100);
  return {
    meses,
    investido,
    bruto: saldo,
    rendimento,
    imposto,
    liquido: saldo - imposto,
    aliquota,
  };
}
