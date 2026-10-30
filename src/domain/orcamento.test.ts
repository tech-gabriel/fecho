import { describe, expect, it } from 'vitest';
import { alertasDeOrcamento, situacaoDoOrcamento } from './orcamento';

const mercado = { id: 1, limiteCentavos: 50_000 };
const lazer = { id: 2, limiteCentavos: 10_000 };
const semLimite = { id: 3 };

let proximaParcela = 1;
const parcela = (
  categoriaId: number | null,
  valorCentavos: number,
  rateios: { terceiroId: number | null; percentual: number }[] = [],
) => ({ parcelaId: proximaParcela++, categoriaId, valorCentavos, rateios });

describe('situacaoDoOrcamento', () => {
  it('soma só a minha parte das parcelas de cada categoria com limite', () => {
    const situacoes = situacaoDoOrcamento(
      [mercado, lazer, semLimite],
      [
        parcela(1, 30_000),
        parcela(1, 20_000, [
          { terceiroId: null, percentual: 50 },
          { terceiroId: 7, percentual: 50 },
        ]),
        parcela(1, 9_999, [{ terceiroId: 7, percentual: 100 }]),
        parcela(3, 99_999),
        parcela(null, 5_000),
      ],
    );

    expect(situacoes).toEqual([
      { categoriaId: 1, limite: 50_000, gasto: 40_000, percentual: 80, faixa: 'perto' },
      { categoriaId: 2, limite: 10_000, gasto: 0, percentual: 0, faixa: 'ok' },
    ]);
  });

  it('separa as faixas em 80% e acima de 100%', () => {
    const faixa = (gasto: number) => situacaoDoOrcamento([lazer], [parcela(2, gasto)])[0]?.faixa;

    expect(faixa(7_999)).toBe('ok');
    expect(faixa(8_000)).toBe('perto');
    expect(faixa(10_000)).toBe('perto');
    expect(faixa(10_001)).toBe('estourou');
  });

  it('ordena do mais apertado para o mais folgado', () => {
    const ordem = situacaoDoOrcamento([mercado, lazer], [parcela(1, 5_000), parcela(2, 9_000)]).map(
      (s) => s.categoriaId,
    );

    expect(ordem).toEqual([2, 1]);
  });
});

describe('alertasDeOrcamento', () => {
  it('avisa só o maior limiar atingido, com chave por limiar', () => {
    const situacoes = situacaoDoOrcamento(
      [mercado, lazer],
      [parcela(1, 41_000), parcela(2, 12_000)],
    );

    expect(alertasDeOrcamento(situacoes, '2026-11', '2026-11-03')).toEqual([
      {
        chave: 'orcamento:2:2026-11:100',
        tipo: 'orcamento',
        cartaoId: 0,
        categoriaId: 2,
        competencia: '2026-11',
        valor: 12_000,
        limite: 10_000,
        data: '2026-11-03',
        dias: 0,
        idade: 0,
      },
      {
        chave: 'orcamento:1:2026-11:80',
        tipo: 'orcamento',
        cartaoId: 0,
        categoriaId: 1,
        competencia: '2026-11',
        valor: 41_000,
        limite: 50_000,
        data: '2026-11-03',
        dias: 0,
        idade: 0,
      },
    ]);
  });

  it('não avisa quem está abaixo de 80%', () => {
    const situacoes = situacaoDoOrcamento([mercado], [parcela(1, 39_999)]);

    expect(alertasDeOrcamento(situacoes, '2026-11', '2026-11-03')).toEqual([]);
  });
});
