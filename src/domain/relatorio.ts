import type { Competencia } from './competencia';
import type { AbaExportada } from './exportacao';
import type { Centavos } from './money';
import { ratear, type Rateio } from './terceiros';

export type VisaoDoRelatorio = 'meu' | 'terceiros' | 'todos';

export const MESES_CURTOS = [
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
];

export interface LinhaDoRelatorio {
  categoriaId: number | null;
  porMes: Centavos[];
  total: Centavos;
}

type MesDoRelatorio = {
  competencia: Competencia;
  parcelas: readonly {
    categoriaId: number | null;
    valorCentavos: Centavos;
    rateios: readonly Rateio[];
  }[];
};

const doze = () => Array.from({ length: 12 }, () => 0);

function parte(valor: Centavos, rateios: readonly Rateio[], visao: VisaoDoRelatorio) {
  if (visao === 'todos') return valor;
  const { meu } = ratear(valor, rateios);
  return visao === 'meu' ? meu : valor - meu;
}

export function relatorioDoAno(meses: readonly MesDoRelatorio[], visao: VisaoDoRelatorio) {
  const porCategoria = new Map<number | null, Centavos[]>();
  for (const { competencia, parcelas } of meses) {
    const mes = Number(competencia.slice(5, 7)) - 1;
    for (const p of parcelas) {
      const valores = porCategoria.get(p.categoriaId) ?? doze();
      valores[mes] = (valores[mes] ?? 0) + parte(p.valorCentavos, p.rateios, visao);
      porCategoria.set(p.categoriaId, valores);
    }
  }
  const linhas: LinhaDoRelatorio[] = [...porCategoria]
    .map(([categoriaId, porMes]) => ({
      categoriaId,
      porMes,
      total: porMes.reduce((a, b) => a + b, 0),
    }))
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total);
  const totaisPorMes = doze().map((_, i) => linhas.reduce((s, l) => s + (l.porMes[i] ?? 0), 0));
  return { linhas, totaisPorMes, total: totaisPorMes.reduce((a, b) => a + b, 0) };
}

const NOMES_DAS_VISOES: [VisaoDoRelatorio, string][] = [
  ['meu', 'Meu'],
  ['terceiros', 'Terceiros'],
  ['todos', 'Todos'],
];

const emReais = (centavos: Centavos) => centavos / 100;

export function abasDoRelatorio(
  meses: readonly MesDoRelatorio[],
  nomeDaCategoria: (id: number | null) => string,
): AbaExportada[] {
  return NOMES_DAS_VISOES.map(([visao, nome]) => {
    const { linhas, totaisPorMes, total } = relatorioDoAno(meses, visao);
    return {
      nome,
      linhas: [
        ['Categoria', ...MESES_CURTOS, 'Total'],
        ...linhas.map((l) => [
          nomeDaCategoria(l.categoriaId),
          ...l.porMes.map(emReais),
          emReais(l.total),
        ]),
        ['Total', ...totaisPorMes.map(emReais), emReais(total)],
      ],
    };
  });
}
