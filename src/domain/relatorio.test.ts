import { describe, expect, it } from 'vitest';
import { abasDoRelatorio, relatorioDoAno, type VisaoDoRelatorio } from './relatorio';

const dividida = [
  { terceiroId: null, percentual: 50 },
  { terceiroId: 7, percentual: 50 },
];
const parcela = (
  categoriaId: number | null,
  valorCentavos: number,
  rateios: { terceiroId: number | null; percentual: number }[] = [],
) => ({ categoriaId, valorCentavos, rateios });

const meses = [
  {
    competencia: '2026-01',
    parcelas: [parcela(1, 10_000), parcela(2, 3_001, dividida), parcela(null, 500)],
  },
  { competencia: '2026-03', parcelas: [parcela(1, 2_000), parcela(2, 8_000, dividida)] },
  { competencia: '2026-12', parcelas: [parcela(3, 1_000, [{ terceiroId: 7, percentual: 100 }])] },
];

const zeros = (valores: Record<number, number>) =>
  Array.from({ length: 12 }, (_, i) => valores[i] ?? 0);

describe('relatorioDoAno', () => {
  it('soma a minha parte de cada categoria por mês, do maior total para o menor', () => {
    const r = relatorioDoAno(meses, 'meu');

    expect(r.linhas).toEqual([
      { categoriaId: 1, porMes: zeros({ 0: 10_000, 2: 2_000 }), total: 12_000 },
      { categoriaId: 2, porMes: zeros({ 0: 1_501, 2: 4_000 }), total: 5_501 },
      { categoriaId: null, porMes: zeros({ 0: 500 }), total: 500 },
    ]);
    expect(r.totaisPorMes).toEqual(zeros({ 0: 12_001, 2: 6_000 }));
    expect(r.total).toBe(18_001);
  });

  it('meu mais terceiros dá o total de todos', () => {
    const total = (visao: VisaoDoRelatorio) => relatorioDoAno(meses, visao).total;

    expect(total('terceiros')).toBe(1_500 + 4_000 + 1_000);
    expect(total('meu') + total('terceiros')).toBe(total('todos'));
    expect(relatorioDoAno(meses, 'terceiros').totaisPorMes[11]).toBe(1_000);
  });

  it('sem parcelas não tem linhas', () => {
    expect(relatorioDoAno([], 'todos')).toEqual({
      linhas: [],
      totaisPorMes: zeros({}),
      total: 0,
    });
  });
});

describe('abasDoRelatorio', () => {
  it('monta uma aba por visão, em reais, com a linha de total', () => {
    const abas = abasDoRelatorio(meses, (id) =>
      id === null ? 'Sem categoria' : `Cat ${String(id)}`,
    );

    expect(abas.map((a) => a.nome)).toEqual(['Meu', 'Terceiros', 'Todos']);
    const meu = abas[0]?.linhas ?? [];
    expect(meu[0]).toEqual([
      'Categoria',
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
      'Total',
    ]);
    expect(meu[1]).toEqual(['Cat 1', 100, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 120]);
    expect(meu.at(-1)).toEqual(['Total', 120.01, 0, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 180.01]);
  });
});
