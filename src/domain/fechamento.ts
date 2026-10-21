import type { Competencia, DataLocal } from './competencia';
import { type DiasDoCartao, datasDaFatura } from './faturas';
import type { Centavos } from './money';

export function saldoDaFatura(total: Centavos, pago: Centavos): Centavos {
  return Math.max(total - pago, 0);
}

export function dataDoSaldo(cartao: DiasDoCartao, competencia: Competencia): DataLocal {
  return datasDaFatura(competencia, cartao).fechamento;
}

export function mesFechadoEntre(
  competencias: readonly Competencia[],
  fechados: ReadonlySet<Competencia>,
): Competencia | null {
  return [...competencias].sort().find((c) => fechados.has(c)) ?? null;
}
