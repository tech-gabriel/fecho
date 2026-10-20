import type { DataLocal } from './competencia';
import type { Centavos } from './money';
import { type Parcela, gerarParcelas } from './parcelas';
import { type Rateio, validarRateio } from './terceiros';

export interface DadosNovaCompra {
  cartaoId: number;
  descricao: string;
  categoriaId: number | null;
  valorTotal: Centavos;
  numParcelas: number;
  dataCompra: DataLocal;
  recorrente: boolean;
  rateios: readonly Rateio[];
}

export interface Compra {
  cartaoId: number;
  descricao: string;
  categoriaId: number | null;
  valorTotalCentavos: Centavos;
  numParcelas: number;
  dataCompra: DataLocal;
  recorrente: boolean;
}

export interface NovaCompraPreparada {
  compra: Compra;
  rateios: Rateio[];
  parcelas: Parcela[];
}

export function prepararNovaCompra(
  dados: DadosNovaCompra,
  cartao: { diaFechamento: number },
): NovaCompraPreparada {
  const descricao = dados.descricao.trim();
  if (!descricao) throw new RangeError('Digite uma descrição');

  validarRateio(dados.rateios);
  const soMeu = dados.rateios.every((r) => r.terceiroId === null);

  return {
    compra: {
      cartaoId: dados.cartaoId,
      descricao,
      categoriaId: dados.categoriaId,
      valorTotalCentavos: dados.valorTotal,
      numParcelas: dados.numParcelas,
      dataCompra: dados.dataCompra,
      recorrente: dados.recorrente,
    },
    rateios: soMeu ? [] : [...dados.rateios],
    parcelas: gerarParcelas(dados, cartao),
  };
}
