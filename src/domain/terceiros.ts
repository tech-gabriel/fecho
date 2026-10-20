import { type DataLocal, diasEntre } from './competencia';
import { type Centavos, assertCentavos, somar } from './money';

export const DIAS_DE_ANTECEDENCIA_DO_ALERTA = 5;

export interface Rateio {
  terceiroId: number | null;
  percentual: number;
}

export type StatusTerceiro = 'pago' | 'atrasado' | 'parcial' | 'pendente';

export function validarRateio(rateios: readonly Rateio[]): void {
  if (rateios.length === 0) return;

  const ids = rateios.map((r) => r.terceiroId);
  if (new Set(ids).size !== ids.length) throw new RangeError('Pessoa repetida no rateio');
  if (
    rateios.some((r) => !Number.isInteger(r.percentual) || r.percentual < 1 || r.percentual > 100)
  ) {
    throw new RangeError('Cada percentual deve ser um inteiro de 1 a 100');
  }
  if (somar(rateios.map((r) => r.percentual)) !== 100) {
    throw new RangeError('Os percentuais devem somar 100');
  }
}

export function ratear(
  valor: Centavos,
  rateios: readonly Rateio[],
): { meu: Centavos; porTerceiro: Map<number, Centavos> } {
  if (assertCentavos(valor) < 0) throw new RangeError(`Valor negativo no rateio: ${valor}`);
  validarRateio(rateios);

  const porTerceiro = new Map<number, Centavos>();
  for (const { terceiroId, percentual } of rateios) {
    if (terceiroId !== null) porTerceiro.set(terceiroId, Math.floor((valor * percentual) / 100));
  }
  return { meu: valor - somar([...porTerceiro.values()]), porTerceiro };
}

export function saldoTerceiro(movimentos: {
  parcelas: readonly Centavos[];
  emprestimosConcedidos: readonly Centavos[];
  depositos: readonly Centavos[];
}): Centavos {
  return (
    somar(movimentos.parcelas) +
    somar(movimentos.emprestimosConcedidos) -
    somar(movimentos.depositos)
  );
}

export function statusTerceiro(situacao: {
  devido: Centavos;
  depositado: Centavos;
  prazo: DataLocal | null;
  hoje: DataLocal;
}): StatusTerceiro {
  if (situacao.devido - situacao.depositado <= 0) return 'pago';
  if (situacao.prazo !== null && diasEntre(situacao.prazo, situacao.hoje) > 0) return 'atrasado';
  if (situacao.depositado > 0) return 'parcial';
  return 'pendente';
}

export function precisaAlertarReembolso(situacao: {
  hoje: DataLocal;
  vencimento: DataLocal;
  faltando: Centavos;
}): boolean {
  return (
    situacao.faltando > 0 &&
    diasEntre(situacao.hoje, situacao.vencimento) <= DIAS_DE_ANTECEDENCIA_DO_ALERTA
  );
}
