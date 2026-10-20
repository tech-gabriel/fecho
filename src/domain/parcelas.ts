import { type Competencia, type DataLocal, somarMeses } from './competencia';
import { competenciaDaCompra } from './faturas';
import { type Centavos, assertCentavos, dividirComResto } from './money';

export const MAXIMO_DE_PARCELAS = 24;

export interface Parcela {
  numero: number;
  competencia: Competencia;
  valorCentavos: Centavos;
}

export function gerarParcelas(
  compra: { valorTotal: Centavos; numParcelas: number; dataCompra: DataLocal },
  cartao: { diaFechamento: number },
): Parcela[] {
  if (assertCentavos(compra.valorTotal) <= 0)
    throw new RangeError('Digite um valor maior que zero');
  if (compra.numParcelas > MAXIMO_DE_PARCELAS) throw new RangeError('O máximo é 24 parcelas');

  const primeira = competenciaDaCompra(compra.dataCompra, cartao.diaFechamento);
  return dividirComResto(compra.valorTotal, compra.numParcelas).map((valorCentavos, i) => ({
    numero: i + 1,
    competencia: somarMeses(primeira, i),
    valorCentavos,
  }));
}
