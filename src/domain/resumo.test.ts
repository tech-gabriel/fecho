import { describe, expect, it } from 'vitest';
import {
  precisoTerEmCaixa,
  receitasDoMes,
  rendaComprometida,
  resumoDoMes,
  saldoReal,
} from './resumo';

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

describe('receitasDoMes', () => {
  const salario = { competencia: '2026-01', competenciaFim: null, recorrente: true };
  const freela = { competencia: '2026-10', competenciaFim: null, recorrente: false };
  const antigo = { competencia: '2025-06', competenciaFim: '2025-12', recorrente: true };

  it('inclui recorrentes vigentes e avulsas do próprio mês', () => {
    expect(receitasDoMes([salario, freela, antigo], '2026-10')).toEqual([salario, freela]);
    expect(receitasDoMes([salario, freela, antigo], '2026-11')).toEqual([salario]);
  });

  it('respeita início e fim da recorrente, inclusive na virada do ano', () => {
    expect(receitasDoMes([antigo], '2025-05')).toEqual([]);
    expect(receitasDoMes([antigo], '2025-12')).toEqual([antigo]);
    expect(receitasDoMes([antigo], '2026-01')).toEqual([]);
  });
});

describe('resumoDoMes com contas fixas', () => {
  it('soma a minha parte nos gastos e as contas pendentes no caixa', () => {
    const resumo = resumoDoMes({
      receitas: [500_000],
      linhas: [{ parcelaId: 1, dono: null, valorCentavos: 10_000 }],
      faturas: [{ total: 10_000, vencimento: '2026-11-05', paga: false }],
      contas: {
        minhaParte: 200_000,
        pendentes: [
          { valor: 180_000, vencimento: '2026-11-10' },
          { valor: 20_000, vencimento: '2026-10-28' },
        ],
      },
    });

    expect(resumo).toMatchObject({
      meusGastos: 210_000,
      saldoReal: 290_000,
      precisoTerEmCaixa: 210_000,
      faturasAbertas: 1,
      contasAbertas: 2,
      ultimoVencimento: '2026-11-10',
    });
  });
});

describe('resumoDoMes', () => {
  const linhas = [
    { parcelaId: 1, dono: null, valorCentavos: 48_730 },
    { parcelaId: 2, dono: 7, valorCentavos: 32_000 },
    { parcelaId: 3, dono: null, valorCentavos: 10_825 },
    { parcelaId: 3, dono: 7, valorCentavos: 10_825 },
  ];

  it('calcula renda, gastos, saldo, terceiros e o que falta pagar', () => {
    expect(
      resumoDoMes({
        receitas: [650_000, 70_000],
        linhas,
        faturas: [
          { total: 102_380, vencimento: '2026-11-05', paga: false },
          { total: 63_000, vencimento: '2026-10-10', paga: false },
          { total: 14_010, vencimento: '2026-10-28', paga: true },
          { total: 0, vencimento: '2026-11-20', paga: false },
        ],
      }),
    ).toEqual({
      renda: 720_000,
      meusGastos: 59_555,
      saldoReal: 660_445,
      deTerceiros: 42_825,
      porTerceiro: new Map([[7, 42_825]]),
      precisoTerEmCaixa: 165_380,
      faturasAbertas: 2,
      contasAbertas: 0,
      ultimoVencimento: '2026-11-05',
    });
  });

  it('sem faturas abertas não há vencimento', () => {
    const resumo = resumoDoMes({
      receitas: [],
      linhas: [],
      faturas: [{ total: 1_000, vencimento: '2026-10-10', paga: true }],
    });
    expect(resumo).toMatchObject({
      precisoTerEmCaixa: 0,
      faturasAbertas: 0,
      ultimoVencimento: null,
      saldoReal: 0,
    });
  });
});

describe('rendaComprometida', () => {
  it('calcula o percentual da renda e devolve null sem renda', () => {
    expect(
      rendaComprometida([
        { competencia: '2026-11', minhasParcelas: 221_000, renda: 720_000 },
        { competencia: '2026-12', minhasParcelas: 10_000, renda: 0 },
      ]),
    ).toEqual([
      {
        competencia: '2026-11',
        valor: 221_000,
        parcelas: 221_000,
        assinaturas: 0,
        contas: 0,
        emprestimos: 0,
        percentual: 30.69,
      },
      {
        competencia: '2026-12',
        valor: 10_000,
        parcelas: 10_000,
        assinaturas: 0,
        contas: 0,
        emprestimos: 0,
        percentual: null,
      },
    ]);
  });
});

describe('rendaComprometida com assinaturas', () => {
  it('soma parcelas e assinaturas e devolve cada série', () => {
    expect(
      rendaComprometida([
        { competencia: '2026-11', minhasParcelas: 200_000, assinaturas: 16_000, renda: 720_000 },
      ]),
    ).toEqual([
      {
        competencia: '2026-11',
        valor: 216_000,
        parcelas: 200_000,
        assinaturas: 16_000,
        contas: 0,
        emprestimos: 0,
        percentual: 30,
      },
    ]);
  });
});

describe('rendaComprometida com contas fixas', () => {
  it('soma as contas na renda comprometida', () => {
    expect(
      rendaComprometida([
        { competencia: '2026-11', minhasParcelas: 100_000, contas: 116_000, renda: 720_000 },
      ])[0],
    ).toMatchObject({ valor: 216_000, contas: 116_000, percentual: 30 });
  });
});

describe('resumo com empréstimos tomados', () => {
  it('desconta as parcelas do mês dos meus gastos e do saldo real (regra 6)', () => {
    const resumo = resumoDoMes({
      receitas: [720_000],
      linhas: [{ parcelaId: 1, dono: null, valorCentavos: 100_000 }],
      faturas: [],
      parcelasEmprestimos: 48_000,
    });
    expect(resumo).toMatchObject({ meusGastos: 148_000, saldoReal: 572_000 });
  });

  it('soma os empréstimos à renda comprometida', () => {
    expect(
      rendaComprometida([
        { competencia: '2026-11', minhasParcelas: 100_000, emprestimos: 48_000, renda: 740_000 },
      ])[0],
    ).toMatchObject({ valor: 148_000, emprestimos: 48_000, percentual: 20 });
  });
});
