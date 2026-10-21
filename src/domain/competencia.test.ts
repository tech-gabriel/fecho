import { describe, expect, it } from 'vitest';
import {
  assertCompetencia,
  assertDataLocal,
  competenciaDe,
  dataNaCompetencia,
  diaDe,
  diasEntre,
  legendaDoMes,
  somarMeses,
  ultimoDia,
} from './competencia';

describe('validação de formato', () => {
  it.each(['2026-10', '1999-01', '2026-12'])('aceita a competência %s', (c) => {
    expect(assertCompetencia(c)).toBe(c);
  });

  it.each(['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01'])(
    'rejeita a competência %s',
    (c) => {
      expect(() => assertCompetencia(c)).toThrow();
    },
  );

  it.each(['2026-10-19', '2028-02-29', '2026-12-31'])('aceita a data %s', (d) => {
    expect(assertDataLocal(d)).toBe(d);
  });

  it.each(['2026-02-29', '2026-04-31', '2026-10-00', '2026-10-1', '19/10/2026'])(
    'rejeita a data %s',
    (d) => {
      expect(() => assertDataLocal(d)).toThrow();
    },
  );
});

describe('competenciaDe e diaDe', () => {
  it('extrai mês e dia sem passar por fuso horário', () => {
    expect(competenciaDe('2026-10-01')).toBe('2026-10');
    expect(diaDe('2026-10-01')).toBe(1);
    expect(diaDe('2026-12-31')).toBe(31);
  });
});

describe('somarMeses', () => {
  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-11', 2, '2027-01'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-10', 0, '2026-10'],
    ['2026-10', 24, '2028-10'],
  ])('%s + %d = %s', (c, n, esperado) => {
    expect(somarMeses(c, n)).toBe(esperado);
  });
});

describe('ultimoDia', () => {
  it.each([
    ['2026-02', 28],
    ['2028-02', 29],
    ['2100-02', 28],
    ['2000-02', 29],
    ['2026-04', 30],
    ['2026-05', 31],
    ['2026-12', 31],
  ])('%s termina no dia %d', (c, dia) => {
    expect(ultimoDia(c)).toBe(dia);
  });
});

describe('dataNaCompetencia', () => {
  it('monta a data no mês', () => {
    expect(dataNaCompetencia('2026-10', 5)).toBe('2026-10-05');
  });

  it('usa o último dia quando o dia não existe no mês', () => {
    expect(dataNaCompetencia('2026-02', 31)).toBe('2026-02-28');
    expect(dataNaCompetencia('2028-02', 30)).toBe('2028-02-29');
    expect(dataNaCompetencia('2026-04', 31)).toBe('2026-04-30');
  });

  it.each([0, 32, 1.5])('rejeita o dia %d', (dia) => {
    expect(() => dataNaCompetencia('2026-10', dia)).toThrow();
  });
});

describe('diasEntre', () => {
  it('conta dias corridos, inclusive atravessando mês, ano e horário de verão', () => {
    expect(diasEntre('2026-10-31', '2026-11-05')).toBe(5);
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3);
    expect(diasEntre('2026-11-05', '2026-10-31')).toBe(-5);
    expect(diasEntre('2026-10-19', '2026-10-19')).toBe(0);
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('legendaDoMes', () => {
  it('conta os dias até o último dia do mês atual', () => {
    expect(legendaDoMes('2026-10', '2026-10-20')).toEqual({ tipo: 'atual', diasParaFechar: 11 });
  });

  it('fecha hoje no último dia do mês', () => {
    expect(legendaDoMes('2026-12', '2026-12-31')).toEqual({ tipo: 'atual', diasParaFechar: 0 });
  });

  it('usa o 29 de fevereiro em ano bissexto', () => {
    expect(legendaDoMes('2028-02', '2028-02-01')).toEqual({ tipo: 'atual', diasParaFechar: 28 });
  });

  it.each([
    ['2026-11', 'futuro'],
    ['2027-01', 'futuro'],
    ['2026-09', 'passado'],
    ['2025-12', 'passado'],
  ])('classifica %s como %s visto de 2026-10-20', (c, tipo) => {
    expect(legendaDoMes(c, '2026-10-20')).toEqual({ tipo });
  });
});

describe('legendaDoMes com meses fechados', () => {
  it('diz fechado para o mês fechado, seja atual ou passado', () => {
    const fechados = new Set(['2026-09', '2026-10']);
    expect(legendaDoMes('2026-09', '2026-10-20', fechados)).toEqual({ tipo: 'fechado' });
    expect(legendaDoMes('2026-10', '2026-10-20', fechados)).toEqual({ tipo: 'fechado' });
    expect(legendaDoMes('2026-08', '2026-10-20', fechados)).toEqual({ tipo: 'passado' });
  });
});
