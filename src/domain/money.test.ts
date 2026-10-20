import { describe, expect, it } from 'vitest';
import { assertCentavos, dividirComResto, somar } from './money';

describe('assertCentavos', () => {
  it.each([0, 1, -250, 123_456_789])('aceita o inteiro %d', (valor) => {
    expect(assertCentavos(valor)).toBe(valor);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita %d',
    (valor) => {
      expect(() => assertCentavos(valor)).toThrow();
    },
  );
});

describe('somar', () => {
  it('soma centavos e devolve 0 para lista vazia', () => {
    expect(somar([1050, 250, -100])).toBe(1200);
    expect(somar([])).toBe(0);
  });

  it('rejeita valor que não é centavo inteiro', () => {
    expect(() => somar([100, 0.5])).toThrow();
  });
});

describe('dividirComResto', () => {
  it('coloca o resto na primeira parte', () => {
    expect(dividirComResto(10_000, 3)).toEqual([3334, 3333, 3333]);
    expect(dividirComResto(10_001, 3)).toEqual([3335, 3333, 3333]);
  });

  it.each([
    [1, 1],
    [7, 7],
    [99_999, 12],
    [129_900, 10],
    [5, 24],
  ])('a soma das %d centavos em %d partes é sempre o total', (total, n) => {
    const partes = dividirComResto(total, n);
    expect(partes).toHaveLength(n);
    expect(somar(partes)).toBe(total);
  });

  it.each([0, -1, 1.5])('rejeita %d partes', (n) => {
    expect(() => dividirComResto(100, n)).toThrow();
  });
});
