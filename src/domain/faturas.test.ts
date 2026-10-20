import { describe, expect, it } from 'vitest';
import {
  competenciaDaCompra,
  datasDaFatura,
  linhasPorDono,
  recalcularFechamento,
  resumoDaFatura,
  statusDaFatura,
} from './faturas';

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

describe('recalcularFechamento', () => {
  const compra = (compraId: number, dataCompra: string, competencias: string[]) => ({
    compraId,
    descricao: 'Compra ' + String(compraId),
    dataCompra,
    parcelas: competencias.map((competencia, i) => ({ numero: i + 1, competencia })),
  });

  it('move a compra que fica entre o dia antigo e o novo, com todas as parcelas', () => {
    const mudancas = recalcularFechamento(
      [
        compra(1, '2026-10-26', ['2026-10', '2026-11', '2026-12']),
        compra(2, '2026-10-10', ['2026-10']),
      ],
      28,
      25,
      '2026-10-20',
    );

    expect(mudancas).toEqual([
      {
        compraId: 1,
        descricao: 'Compra 1',
        de: '2026-10',
        para: '2026-11',
        parcelas: [
          { numero: 1, competencia: '2026-11' },
          { numero: 2, competencia: '2026-12' },
          { numero: 3, competencia: '2027-01' },
        ],
      },
    ]);
  });

  it('não mexe em compras de faturas anteriores à aberta', () => {
    expect(
      recalcularFechamento([compra(1, '2026-09-27', ['2026-09'])], 28, 25, '2026-10-20'),
    ).toEqual([]);
  });

  it('aumentar o dia traz a compra de volta, inclusive na virada do ano', () => {
    const [mudanca] = recalcularFechamento(
      [compra(1, '2026-12-29', ['2027-01', '2027-02'])],
      28,
      31,
      '2026-12-20',
    );

    expect(mudanca).toMatchObject({ de: '2027-01', para: '2026-12' });
    expect(mudanca?.parcelas.map((p) => p.competencia)).toEqual(['2026-12', '2027-01']);
  });

  it('fechamento 31 em fevereiro usa o último dia do mês', () => {
    expect(
      recalcularFechamento([compra(1, '2027-02-28', ['2027-03'])], 28, 31, '2027-02-10'),
    ).toEqual([]);
  });

  it('a fatura aberta é calculada pelo dia antigo', () => {
    const [mudanca] = recalcularFechamento(
      [compra(1, '2026-10-27', ['2026-10'])],
      25,
      28,
      '2026-10-26',
    );

    expect(mudanca).toBeUndefined();
  });
});

describe('recalcularFechamento com faturas pagas', () => {
  it('não move compras de fatura já paga', () => {
    const compras = [
      {
        compraId: 1,
        descricao: 'Tênis',
        dataCompra: '2026-10-26',
        parcelas: [{ numero: 1, competencia: '2026-10' }],
      },
    ];

    expect(recalcularFechamento(compras, 28, 25, '2026-10-20', ['2026-10'])).toEqual([]);
    expect(recalcularFechamento(compras, 28, 25, '2026-10-20', ['2026-09'])).toHaveLength(1);
  });
});

describe('statusDaFatura', () => {
  it.each([
    [{ vencimento: '2026-11-05', pagoEm: '2026-11-01' }, '2026-11-20', 'paga'],
    [{ vencimento: '2026-11-05', pagoEm: null }, '2026-11-05', 'pendente'],
    [{ vencimento: '2026-11-05', pagoEm: null }, '2026-11-06', 'atrasada'],
    [{ vencimento: '2026-11-05', pagoEm: null }, '2026-10-20', 'pendente'],
  ] as const)('%j em %s → %s', (fatura, hoje, status) => {
    expect(statusDaFatura(fatura, hoje)).toBe(status);
  });
});

describe('linhas e resumo da fatura', () => {
  const parcelas = [
    { parcelaId: 1, valorCentavos: 21_651, rateios: [] },
    {
      parcelaId: 2,
      valorCentavos: 10_001,
      rateios: [
        { terceiroId: null, percentual: 50 },
        { terceiroId: 7, percentual: 50 },
      ],
    },
    { parcelaId: 3, valorCentavos: 9_000, rateios: [{ terceiroId: 8, percentual: 100 }] },
  ];

  it('separa uma linha por dono, com o centavo que sobra comigo', () => {
    expect(linhasPorDono(parcelas)).toEqual([
      { parcelaId: 1, dono: null, valorCentavos: 21_651 },
      { parcelaId: 2, dono: null, valorCentavos: 5_001 },
      { parcelaId: 2, dono: 7, valorCentavos: 5_000 },
      { parcelaId: 3, dono: 8, valorCentavos: 9_000 },
    ]);
  });

  it('resume total, meu e por pessoa', () => {
    expect(resumoDaFatura(linhasPorDono(parcelas))).toEqual({
      total: 40_652,
      meu: 26_652,
      porTerceiro: new Map([
        [7, 5_000],
        [8, 9_000],
      ]),
    });
  });
});
