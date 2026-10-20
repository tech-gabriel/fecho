import { describe, expect, it } from 'vitest';
import { competenciaDaCompra, datasDaFatura } from './faturas';

describe('competenciaDaCompra', () => {
  it.each([
    ['2026-10-27', 28, '2026-10', 'véspera do fechamento entra no mês'],
    ['2026-10-28', 28, '2026-11', 'no dia do fechamento vai para o mês seguinte'],
    ['2026-10-29', 28, '2026-11', 'depois do fechamento vai para o mês seguinte'],
    ['2026-12-09', 10, '2026-12', 'dezembro antes do fechamento'],
    ['2026-12-31', 10, '2027-01', 'vira o ano'],
    ['2026-02-27', 31, '2026-02', 'fevereiro de 28 dias, antes do último dia'],
    ['2026-02-28', 31, '2026-03', 'fevereiro de 28 dias fecha no dia 28'],
    ['2028-02-28', 31, '2028-02', 'fevereiro de 29 dias, antes do último dia'],
    ['2028-02-29', 31, '2028-03', 'fevereiro de 29 dias fecha no dia 29'],
    ['2026-04-29', 31, '2026-04', 'abril (30), antes do último dia'],
    ['2026-04-30', 31, '2026-05', 'abril (30) fecha no dia 30'],
    ['2026-05-30', 31, '2026-05', 'maio (31), antes do fechamento'],
    ['2026-05-31', 31, '2026-06', 'maio (31) fecha no dia 31'],
    ['2026-10-01', 1, '2026-11', 'fechamento no dia 1'],
  ])('%s com fechamento dia %d → %s (%s)', (data, fechamento, esperado) => {
    expect(competenciaDaCompra(data, fechamento)).toBe(esperado);
  });

  it.each([0, 32, 2.5])('rejeita dia de fechamento %d', (dia) => {
    expect(() => competenciaDaCompra('2026-10-10', dia)).toThrow();
  });
});

describe('datasDaFatura', () => {
  it('vence no mês seguinte quando o vencimento é antes do fechamento', () => {
    expect(datasDaFatura('2026-10', { diaFechamento: 28, diaVencimento: 5 })).toEqual({
      fechamento: '2026-10-28',
      vencimento: '2026-11-05',
    });
  });

  it('vira o ano no vencimento', () => {
    expect(datasDaFatura('2026-12', { diaFechamento: 28, diaVencimento: 5 }).vencimento).toBe(
      '2027-01-05',
    );
  });

  it('vence no mesmo mês quando o vencimento é depois do fechamento', () => {
    expect(datasDaFatura('2026-10', { diaFechamento: 5, diaVencimento: 15 })).toEqual({
      fechamento: '2026-10-05',
      vencimento: '2026-10-15',
    });
  });

  it('vence no mesmo mês quando fechamento e vencimento são o mesmo dia', () => {
    expect(datasDaFatura('2026-10', { diaFechamento: 10, diaVencimento: 10 }).vencimento).toBe(
      '2026-10-10',
    );
  });

  it('usa o último dia do mês para fechamento e vencimento que não existem', () => {
    expect(datasDaFatura('2026-02', { diaFechamento: 31, diaVencimento: 10 })).toEqual({
      fechamento: '2026-02-28',
      vencimento: '2026-03-10',
    });
    expect(datasDaFatura('2026-04', { diaFechamento: 20, diaVencimento: 31 }).vencimento).toBe(
      '2026-04-30',
    );
  });

  it('rejeita dias fora de 1 a 31', () => {
    expect(() => datasDaFatura('2026-10', { diaFechamento: 28, diaVencimento: 0 })).toThrow();
    expect(() => datasDaFatura('2026-10', { diaFechamento: 32, diaVencimento: 5 })).toThrow();
  });
});
