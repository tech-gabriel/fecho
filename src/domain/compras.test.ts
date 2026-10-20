import { describe, expect, it } from 'vitest';
import { prepararNovaCompra } from './compras';

const cartaoRoxo = { diaFechamento: 28 };
const base = {
  cartaoId: 1,
  descricao: '  Mercado Pão de Açúcar ',
  categoriaId: 2,
  valorTotal: 64_950,
  numParcelas: 3,
  dataCompra: '2026-10-19',
  recorrente: false,
  rateios: [],
};

describe('prepararNovaCompra', () => {
  it('normaliza a compra e gera as parcelas pelo fechamento do cartão', () => {
    const { compra, rateios, parcelas } = prepararNovaCompra(base, cartaoRoxo);

    expect(compra).toEqual({
      cartaoId: 1,
      descricao: 'Mercado Pão de Açúcar',
      categoriaId: 2,
      valorTotalCentavos: 64_950,
      numParcelas: 3,
      dataCompra: '2026-10-19',
      recorrente: false,
    });
    expect(rateios).toEqual([]);
    expect(parcelas.map((p) => [p.numero, p.competencia, p.valorCentavos])).toEqual([
      [1, '2026-10', 21_650],
      [2, '2026-11', 21_650],
      [3, '2026-12', 21_650],
    ]);
  });

  it('guarda o rateio com terceiros', () => {
    const rateios = [
      { terceiroId: null, percentual: 50 },
      { terceiroId: 7, percentual: 50 },
    ];
    expect(prepararNovaCompra({ ...base, rateios }, cartaoRoxo).rateios).toEqual(rateios);
  });

  it('trata "100% meu" como compra sem rateio', () => {
    expect(
      prepararNovaCompra({ ...base, rateios: [{ terceiroId: null, percentual: 100 }] }, cartaoRoxo)
        .rateios,
    ).toEqual([]);
  });

  it('aceita compra sem categoria', () => {
    expect(prepararNovaCompra({ ...base, categoriaId: null }, cartaoRoxo).compra.categoriaId).toBe(
      null,
    );
  });

  it.each(['', '   '])('rejeita descrição vazia (%j)', (descricao) => {
    expect(() => prepararNovaCompra({ ...base, descricao }, cartaoRoxo)).toThrow(
      'Digite uma descrição',
    );
  });

  it('propaga as validações de valor, parcelas e rateio', () => {
    expect(() => prepararNovaCompra({ ...base, valorTotal: 0 }, cartaoRoxo)).toThrow(
      'Digite um valor maior que zero',
    );
    expect(() => prepararNovaCompra({ ...base, numParcelas: 30 }, cartaoRoxo)).toThrow(
      'O máximo é 24 parcelas',
    );
    expect(() =>
      prepararNovaCompra({ ...base, rateios: [{ terceiroId: 7, percentual: 40 }] }, cartaoRoxo),
    ).toThrow('Os percentuais devem somar 100');
  });
});
