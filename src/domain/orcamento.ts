import type { Alerta } from './alertas';
import type { Competencia, DataLocal } from './competencia';
import type { Centavos } from './money';
import { ratear, type Rateio } from './terceiros';

export const LIMIAR_DE_AVISO = 80;

export type FaixaDoOrcamento = 'ok' | 'perto' | 'estourou';

export interface SituacaoDoOrcamento {
  categoriaId: number;
  limite: Centavos;
  gasto: Centavos;
  percentual: number;
  faixa: FaixaDoOrcamento;
}

export function situacaoDoOrcamento(
  categorias: readonly { id: number; limiteCentavos?: Centavos | null }[],
  parcelas: readonly {
    categoriaId: number | null;
    valorCentavos: Centavos;
    rateios: readonly Rateio[];
  }[],
): SituacaoDoOrcamento[] {
  const gastos = new Map<number, Centavos>();
  for (const p of parcelas) {
    if (p.categoriaId === null) continue;
    const { meu } = ratear(p.valorCentavos, p.rateios);
    gastos.set(p.categoriaId, (gastos.get(p.categoriaId) ?? 0) + meu);
  }
  return categorias
    .flatMap(({ id, limiteCentavos: limite }) => {
      if (!limite) return [];
      const gasto = gastos.get(id) ?? 0;
      const faixa: FaixaDoOrcamento =
        gasto > limite ? 'estourou' : gasto * 100 >= limite * LIMIAR_DE_AVISO ? 'perto' : 'ok';
      return [
        { categoriaId: id, limite, gasto, percentual: Math.floor((gasto * 100) / limite), faixa },
      ];
    })
    .sort((a, b) => b.gasto * a.limite - a.gasto * b.limite);
}

export function alertasDeOrcamento(
  situacoes: readonly SituacaoDoOrcamento[],
  competencia: Competencia,
  hoje: DataLocal,
): Alerta[] {
  return situacoes
    .filter((s) => s.faixa !== 'ok')
    .map((s) => ({
      chave: `orcamento:${String(s.categoriaId)}:${competencia}:${s.faixa === 'estourou' ? '100' : String(LIMIAR_DE_AVISO)}`,
      tipo: 'orcamento',
      cartaoId: 0,
      categoriaId: s.categoriaId,
      competencia,
      valor: s.gasto,
      limite: s.limite,
      data: hoje,
      dias: 0,
      idade: 0,
    }));
}
