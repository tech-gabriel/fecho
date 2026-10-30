import { describe, expect, it } from 'vitest';
import { aliquotaDoIr, anualDaPoupanca, rendimentoDe, simular } from './simulador';

describe('simular', () => {
  it('rende juros compostos mês a mês em centavos', () => {
    const r = simular({ inicial: 100_000, mensal: 0, taxaAnualPct: 12, meses: 12, ir: false });

    expect(r.bruto).toBe(112_000);
    expect(r.rendimento).toBe(12_000);
    expect(r.imposto).toBe(0);
    expect(r.liquido).toBe(112_000);
    expect(r.meses).toHaveLength(13);
    expect(r.meses[0]).toEqual({ mes: 0, investido: 100_000, saldo: 100_000 });
  });

  it('soma o aporte no fim de cada mês e desconta o IR do rendimento', () => {
    const r = simular({ inicial: 0, mensal: 10_000, taxaAnualPct: 10, meses: 24, ir: true });

    expect(r.investido).toBe(240_000);
    expect(r.bruto).toBe(263_352);
    expect(r.aliquota).toBe(17.5);
    expect(r.imposto).toBe(Math.round(23_352 * 0.175));
    expect(r.liquido).toBe(263_352 - r.imposto);
  });

  it('com prazo zero devolve só o que entrou', () => {
    const r = simular({ inicial: 5_000, mensal: 1_000, taxaAnualPct: 10, meses: 0, ir: true });

    expect(r.liquido).toBe(5_000);
    expect(r.rendimento).toBe(0);
  });
});

describe('aliquotaDoIr', () => {
  it('segue a tabela regressiva da renda fixa', () => {
    expect([1, 6, 7, 12, 13, 24, 25, 120].map(aliquotaDoIr)).toEqual([
      22.5, 22.5, 20, 20, 17.5, 17.5, 15, 15,
    ]);
  });
});

describe('rendimentoDe', () => {
  const taxas = { cdi: 13.65, selic: 13.75, poupancaMensal: 0.67, data: '2026-10-29' };

  it('converte cada tipo para taxa anual', () => {
    expect(rendimentoDe('cdi', taxas, 110, 0)).toBeCloseTo(15.015);
    expect(rendimentoDe('selic', taxas, 100, 0)).toBe(13.75);
    expect(rendimentoDe('poupanca', taxas, 100, 0)).toBeCloseTo(8.343, 3);
    expect(rendimentoDe('fixa', null, 100, 11.5)).toBe(11.5);
  });

  it('sem taxas salvas só a taxa fixa funciona', () => {
    expect(rendimentoDe('cdi', null, 100, 11.5)).toBeNull();
  });

  it('converte a poupança mensal para anual', () => {
    expect(anualDaPoupanca(0.5)).toBeCloseTo(6.168, 3);
  });
});
