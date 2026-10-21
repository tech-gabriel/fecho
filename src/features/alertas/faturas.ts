import type {
  Cartao,
  EmprestimoConcedido,
  EmprestimoTomado,
  Movimento,
  PagamentoDeFatura,
  PagamentoDeParcela,
  ParcelaDoMes,
  Repositorios,
  Terceiro,
} from '@/data';
import type { EmprestimosParaAlerta, FaturaParaAlerta } from '@/domain/alertas';
import type { Competencia, DataLocal } from '@/domain/competencia';
import { parcelasDoTomado } from '@/domain/emprestimos';
import { montarFaturas } from '@/features/faturas/Faturas';
import { faltaNaFatura, montarSituacoes } from '@/features/receber/situacoes';

export interface FaturasCarregadas {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  pagamentos: PagamentoDeFatura[];
  movimentos: Movimento[];
  deTerceiros: ParcelaDoMes[];
  porMes: { competencia: Competencia; parcelas: ParcelaDoMes[] }[];
  tomados: EmprestimoTomado[];
  concedidos: EmprestimoConcedido[];
  pagamentosDeParcela: PagamentoDeParcela[];
}

export async function carregarFaturas(
  repos: Repositorios,
  competencias: readonly Competencia[],
): Promise<FaturasCarregadas> {
  const meses = [...new Set(competencias)].sort();
  const ultimo = meses.at(-1) ?? '';
  const [
    cartoes,
    terceiros,
    parcelas,
    pagamentos,
    deTerceiros,
    movimentos,
    tomados,
    concedidos,
    pagamentosDeParcela,
  ] = await Promise.all([
    repos.cartoes.listar(),
    repos.terceiros.listar(),
    Promise.all(meses.map((m) => repos.compras.parcelasDaCompetencia(m))),
    repos.faturas.pagamentos(),
    repos.compras.parcelasDeTerceiros(ultimo),
    repos.receber.movimentos(),
    repos.emprestimos.tomados.listar(),
    repos.emprestimos.concedidos.listar(),
    repos.emprestimos.pagamentos(),
  ]);
  return {
    cartoes,
    terceiros,
    pagamentos,
    movimentos,
    deTerceiros,
    porMes: meses.map((competencia, i) => ({ competencia, parcelas: parcelas[i] ?? [] })),
    tomados,
    concedidos,
    pagamentosDeParcela,
  };
}

function situacoesAte(dados: FaturasCarregadas, hoje: DataLocal) {
  const ultimo = dados.porMes.at(-1);
  if (!ultimo) return [];
  return montarSituacoes({
    ...dados,
    parcelas: dados.deTerceiros,
    competencia: ultimo.competencia,
    hoje,
  });
}

export function faturasParaAlerta(dados: FaturasCarregadas, hoje: DataLocal): FaturaParaAlerta[] {
  const situacoes = situacoesAte(dados, hoje);
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

export function emprestimosParaAlerta(
  dados: FaturasCarregadas,
  hoje: DataLocal,
): EmprestimosParaAlerta {
  const devolucoes = situacoesAte(dados, hoje).flatMap(({ terceiro, itens }) =>
    itens.flatMap((item) =>
      item.emprestimoId === undefined
        ? []
        : [
            {
              emprestimoId: item.emprestimoId,
              terceiroId: terceiro.id,
              prazo: item.vencimento,
              falta: item.aberto,
            },
          ],
    ),
  );
  const parcelas = dados.tomados.flatMap((emprestimo) =>
    parcelasDoTomado(emprestimo, dados.pagamentosDeParcela, hoje).map((p) => ({
      emprestimoId: emprestimo.id,
      numero: p.numero,
      vencimento: p.vencimento,
      valor: p.valor,
      paga: p.status === 'paga',
    })),
  );
  return { devolucoes, parcelas };
}
