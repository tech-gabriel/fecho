import type {
  Cartao,
  Movimento,
  PagamentoDeFatura,
  ParcelaDoMes,
  Repositorios,
  Terceiro,
} from '@/data';
import type { FaturaParaAlerta } from '@/domain/alertas';
import type { Competencia, DataLocal } from '@/domain/competencia';
import { montarFaturas } from '@/features/faturas/Faturas';
import { faltaNaFatura, montarSituacoes } from '@/features/receber/situacoes';

export interface FaturasCarregadas {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  pagamentos: PagamentoDeFatura[];
  movimentos: Movimento[];
  deTerceiros: ParcelaDoMes[];
  porMes: { competencia: Competencia; parcelas: ParcelaDoMes[] }[];
}

export async function carregarFaturas(
  repos: Repositorios,
  competencias: readonly Competencia[],
): Promise<FaturasCarregadas> {
  const meses = [...new Set(competencias)].sort();
  const ultimo = meses.at(-1) ?? '';
  const [cartoes, terceiros, parcelas, pagamentos, deTerceiros, movimentos] = await Promise.all([
    repos.cartoes.listar(),
    repos.terceiros.listar(),
    Promise.all(meses.map((m) => repos.compras.parcelasDaCompetencia(m))),
    repos.faturas.pagamentos(),
    repos.compras.parcelasDeTerceiros(ultimo),
    repos.receber.movimentos(),
  ]);
  return {
    cartoes,
    terceiros,
    pagamentos,
    movimentos,
    deTerceiros,
    porMes: meses.map((competencia, i) => ({ competencia, parcelas: parcelas[i] ?? [] })),
  };
}

export function faturasParaAlerta(dados: FaturasCarregadas, hoje: DataLocal): FaturaParaAlerta[] {
  const ultimo = dados.porMes.at(-1);
  if (!ultimo) return [];
  const situacoes = montarSituacoes({
    ...dados,
    parcelas: dados.deTerceiros,
    competencia: ultimo.competencia,
    hoje,
  });
  return dados.porMes.flatMap(({ competencia, parcelas }) =>
    montarFaturas({ ...dados, parcelas }, competencia, hoje).map((f) => ({
      cartaoId: f.cartao.id,
      competencia: f.competencia,
      vencimento: f.vencimento,
      total: f.resumo.total,
      paga: f.pagamento !== undefined,
      faltaPorTerceiro: faltaNaFatura(situacoes, f.cartao.id, f.competencia).map(
        ({ terceiro, falta }) => ({ terceiroId: terceiro.id, falta }),
      ),
    })),
  );
}
