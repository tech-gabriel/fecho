import { describe, expect, it } from 'vitest';
import {
  precisaAlertarReembolso,
  ratear,
  saldoTerceiro,
  statusTerceiro,
  validarRateio,
} from './terceiros';

const ANA = 1;
const BRUNO = 2;

describe('validarRateio', () => {
  it('aceita rateio vazio (100% meu) e rateios que somam 100', () => {
    expect(() => {
      validarRateio([]);
    }).not.toThrow();
    expect(() => {
      validarRateio([
        { terceiroId: null, percentual: 50 },
        { terceiroId: ANA, percentual: 50 },
      ]);
    }).not.toThrow();
    expect(() => {
      validarRateio([{ terceiroId: ANA, percentual: 100 }]);
    }).not.toThrow();
  });

  it.each([
    [[{ terceiroId: ANA, percentual: 60 }], 'soma diferente de 100'],
    [
      [
        { terceiroId: ANA, percentual: 0 },
        { terceiroId: null, percentual: 100 },
      ],
      'percentual zero',
    ],
    [
      [
        { terceiroId: ANA, percentual: 50.5 },
        { terceiroId: null, percentual: 49.5 },
      ],
      'percentual fracionado',
    ],
    [
      [
        { terceiroId: ANA, percentual: 50 },
        { terceiroId: ANA, percentual: 50 },
      ],
      'terceiro repetido',
    ],
    [
      [
        { terceiroId: null, percentual: 50 },
        { terceiroId: null, percentual: 50 },
      ],
      '"meu" repetido',
    ],
  ])('rejeita %j (%s)', (rateios) => {
    expect(() => {
      validarRateio(rateios);
    }).toThrow();
  });
});

describe('ratear', () => {
  it('sem rateio, tudo é meu', () => {
    expect(ratear(10_001, [])).toEqual({ meu: 10_001, porTerceiro: new Map() });
  });

  it('meio a meio: o centavo que sobra fica comigo', () => {
    expect(
      ratear(10_001, [
        { terceiroId: null, percentual: 50 },
        { terceiroId: ANA, percentual: 50 },
      ]),
    ).toEqual({ meu: 5001, porTerceiro: new Map([[ANA, 5000]]) });
  });

  it('100% de um terceiro não deixa nada para mim', () => {
    expect(ratear(21_650, [{ terceiroId: ANA, percentual: 100 }])).toEqual({
      meu: 0,
      porTerceiro: new Map([[ANA, 21_650]]),
    });
  });

  it('dois terceiros com valor ímpar: o centavo fica comigo mesmo sem parte minha', () => {
    expect(
      ratear(10_001, [
        { terceiroId: ANA, percentual: 50 },
        { terceiroId: BRUNO, percentual: 50 },
      ]),
    ).toEqual({
      meu: 1,
      porTerceiro: new Map([
        [ANA, 5000],
        [BRUNO, 5000],
      ]),
    });
  });

  it('rejeita rateio inválido e valor negativo', () => {
    expect(() => ratear(100, [{ terceiroId: ANA, percentual: 40 }])).toThrow();
    expect(() => ratear(-100, [])).toThrow();
  });
});

describe('saldoTerceiro', () => {
  it('soma parcelas e empréstimos e desconta depósitos', () => {
    expect(
      saldoTerceiro({
        parcelas: [10_825, 21_175],
        emprestimosConcedidos: [80_000],
        depositos: [43_000],
      }),
    ).toBe(69_000);
  });

  it('fica negativo (crédito) quando a pessoa deposita a mais', () => {
    expect(
      saldoTerceiro({ parcelas: [32_000], emprestimosConcedidos: [], depositos: [35_000] }),
    ).toBe(-3000);
  });
});

describe('statusTerceiro', () => {
  const prazo = '2026-11-05';

  it.each([
    [{ devido: 32_000, depositado: 32_000, prazo, hoje: '2026-11-10' }, 'pago'],
    [{ devido: 32_000, depositado: 35_000, prazo, hoje: '2026-10-19' }, 'pago'],
    [{ devido: 32_000, depositado: 0, prazo, hoje: '2026-11-06' }, 'atrasado'],
    [{ devido: 32_000, depositado: 10_000, prazo, hoje: '2026-11-06' }, 'atrasado'],
    [{ devido: 32_000, depositado: 10_000, prazo, hoje: '2026-11-05' }, 'parcial'],
    [{ devido: 32_000, depositado: 0, prazo, hoje: '2026-11-05' }, 'pendente'],
    [{ devido: 80_000, depositado: 0, prazo: null, hoje: '2027-06-01' }, 'pendente'],
  ])('%j → %s', (situacao, esperado) => {
    expect(statusTerceiro(situacao)).toBe(esperado);
  });
});

describe('precisaAlertarReembolso', () => {
  const vencimento = '2026-11-05';

  it.each([
    ['2026-10-30', 32_000, false, '6 dias antes'],
    ['2026-10-31', 32_000, true, '5 dias antes'],
    ['2026-11-05', 32_000, true, 'no vencimento'],
    ['2026-11-12', 32_000, true, 'depois de vencido'],
    ['2026-11-01', 0, false, 'sem saldo em aberto'],
    ['2026-11-01', -500, false, 'com crédito'],
  ])('hoje %s, faltando %d → %s (%s)', (hoje, faltando, esperado) => {
    expect(precisaAlertarReembolso({ hoje, vencimento, faltando })).toBe(esperado);
  });
});
