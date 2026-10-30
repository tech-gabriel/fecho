import { describe, expect, it } from 'vitest';
import { soDecimal, soDigitos, soDinheiro } from './entrada';

describe('soDinheiro', () => {
  it('deixa só dígitos, pontos de milhar e uma vírgula com até 2 casas', () => {
    expect(soDinheiro('1.234,56')).toBe('1.234,56');
    expect(soDinheiro('abc12,345')).toBe('12,34');
    expect(soDinheiro('R$ 1.234,56')).toBe('1.234,56');
    expect(soDinheiro('-50')).toBe('50');
    expect(soDinheiro('1e5')).toBe('15');
    expect(soDinheiro('10,5,3')).toBe('10,53');
    expect(soDinheiro('')).toBe('');
  });
});

describe('soDigitos', () => {
  it('deixa só dígitos até o máximo', () => {
    expect(soDigitos(2)('3x1')).toBe('31');
    expect(soDigitos(2)('123')).toBe('12');
    expect(soDigitos(4)('12-34')).toBe('1234');
    expect(soDigitos(3)('1e5')).toBe('15');
  });
});

describe('soDecimal', () => {
  it('aceita uma vírgula ou ponto como separador, com até 2 casas', () => {
    expect(soDecimal('11,5')).toBe('11,5');
    expect(soDecimal('11.5')).toBe('11,5');
    expect(soDecimal('1a1,555')).toBe('11,55');
    expect(soDecimal('1,2,3')).toBe('1,23');
  });
});
