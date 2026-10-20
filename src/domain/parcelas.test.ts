import { describe, expect, it } from 'vitest';
import { somar } from './money';
import { gerarParcelas } from './parcelas';

const cartaoRoxo = { diaFechamento: 28 };

describe('gerarParcelas', () => {
  it('divide em centavos com o resto na primeira parcela', () => {
    expect(
      gerarParcelas({ valorTotal: 10_000, numParcelas: 3, dataCompra: '2026-10-19' }, cartaoRoxo),
    ).toEqual([
      { numero: 1, competencia: '2026-10', valorCentavos: 3334 },
      { numero: 2, competencia: '2026-11', valorCentavos: 3333 },
      { numero: 3, competencia: '2026-12', valorCentavos: 3333 },
    ]);
  });

  it('começa na fatura seguinte quando a compra é no dia do fechamento', () => {
    const [primeira] = gerarParcelas(
      { valorTotal: 5000, numParcelas: 2, dataCompra: '2026-10-28' },
      cartaoRoxo,
    );
    expect(primeira?.competencia).toBe('2026-11');
  });

  it('atravessa a virada do ano', () => {
    const parcelas = gerarParcelas(
      { valorTotal: 129_900, numParcelas: 12, dataCompra: '2026-11-03' },
      cartaoRoxo,
    );
    expect(parcelas.map((p) => p.competencia)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
      '2027-06',
      '2027-07',
      '2027-08',
      '2027-09',
      '2027-10',
    ]);
  });

  it('à vista gera uma parcela com o total', () => {
    expect(
      gerarParcelas({ valorTotal: 4590, numParcelas: 1, dataCompra: '2026-10-19' }, cartaoRoxo),
    ).toEqual([{ numero: 1, competencia: '2026-10', valorCentavos: 4590 }]);
  });

  it.each([
    [1, 1],
    [99_999, 7],
    [100_001, 24],
    [23, 24],
  ])('a soma de %d centavos em %d× é sempre o total', (valorTotal, numParcelas) => {
    const parcelas = gerarParcelas(
      { valorTotal, numParcelas, dataCompra: '2026-10-19' },
      cartaoRoxo,
    );
    expect(somar(parcelas.map((p) => p.valorCentavos))).toBe(valorTotal);
  });

  it.each([0, -100])('rejeita valor %d', (valorTotal) => {
    expect(() =>
      gerarParcelas({ valorTotal, numParcelas: 1, dataCompra: '2026-10-19' }, cartaoRoxo),
    ).toThrow('Digite um valor maior que zero');
  });

  it('rejeita mais de 24 parcelas', () => {
    expect(() =>
      gerarParcelas({ valorTotal: 1000, numParcelas: 25, dataCompra: '2026-10-19' }, cartaoRoxo),
    ).toThrow('O máximo é 24 parcelas');
  });

  it.each([0, 2.5])('rejeita %d parcelas', (numParcelas) => {
    expect(() =>
      gerarParcelas({ valorTotal: 1000, numParcelas, dataCompra: '2026-10-19' }, cartaoRoxo),
    ).toThrow();
  });
});
