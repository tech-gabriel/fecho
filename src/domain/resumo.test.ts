import { describe, expect, it } from 'vitest';
import { precisoTerEmCaixa, saldoReal } from './resumo';

describe('saldoReal', () => {
  it('é receitas menos minhas parcelas, despesas fixas e parcelas de empréstimos tomados', () => {
    expect(
      saldoReal({
        receitas: [720_000],
        minhasParcelas: [216_500, 120_030],
        despesasFixas: [150_000],
        parcelasEmprestimosTomados: [48_000],
      }),
    ).toBe(185_470);
  });

  it('fica negativo quando sai mais do que entra', () => {
    expect(
      saldoReal({
        receitas: [100_000],
        minhasParcelas: [90_000],
        despesasFixas: [20_000],
        parcelasEmprestimosTomados: [],
      }),
    ).toBe(-10_000);
  });
});

describe('precisoTerEmCaixa', () => {
  it('soma as faturas do mês (meu + terceiros) e mostra o que os terceiros já depositaram', () => {
    expect(
      precisoTerEmCaixa([
        { meu: 185_030, deTerceiros: 60_000, depositadoPorTerceiros: 28_000 },
        { meu: 152_000, deTerceiros: 30_000, depositadoPorTerceiros: 15_000 },
        { meu: 60_000, deTerceiros: 0, depositadoPorTerceiros: 0 },
      ]),
    ).toEqual({
      total: 487_030,
      deTerceiros: 90_000,
      jaDepositado: 43_000,
      faltaDepositar: 47_000,
    });
  });

  it('não mostra falta negativa quando os terceiros depositam a mais', () => {
    expect(
      precisoTerEmCaixa([{ meu: 0, deTerceiros: 10_000, depositadoPorTerceiros: 12_000 }])
        .faltaDepositar,
    ).toBe(0);
  });

  it('mês sem faturas', () => {
    expect(precisoTerEmCaixa([])).toEqual({
      total: 0,
      deTerceiros: 0,
      jaDepositado: 0,
      faltaDepositar: 0,
    });
  });
});
