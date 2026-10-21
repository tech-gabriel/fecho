import type { Competencia, DataLocal } from './competencia';
import { type LinhaDaFatura, resumoDaFatura } from './faturas';
import { type Centavos, somar } from './money';

export function saldoReal(mes: {
  receitas: readonly Centavos[];
  minhasParcelas: readonly Centavos[];
  despesasFixas: readonly Centavos[];
  parcelasEmprestimosTomados: readonly Centavos[];
}): Centavos {
  return (
    somar(mes.receitas) -
    somar(mes.minhasParcelas) -
    somar(mes.despesasFixas) -
    somar(mes.parcelasEmprestimosTomados)
  );
}

export function precisoTerEmCaixa(
  faturasDoMes: readonly {
    meu: Centavos;
    deTerceiros: Centavos;
    depositadoPorTerceiros: Centavos;
  }[],
): { total: Centavos; deTerceiros: Centavos; jaDepositado: Centavos; faltaDepositar: Centavos } {
  const deTerceiros = somar(faturasDoMes.map((f) => f.deTerceiros));
  const jaDepositado = somar(faturasDoMes.map((f) => f.depositadoPorTerceiros));
  return {
    total: somar(faturasDoMes.map((f) => f.meu)) + deTerceiros,
    deTerceiros,
    jaDepositado,
    faltaDepositar: Math.max(0, deTerceiros - jaDepositado),
  };
}

export function receitasDoMes<
  R extends { competencia: Competencia; competenciaFim: Competencia | null; recorrente: boolean },
>(receitas: readonly R[], competencia: Competencia): R[] {
  return receitas.filter((r) =>
    r.recorrente
      ? r.competencia <= competencia &&
        (r.competenciaFim === null || competencia <= r.competenciaFim)
      : r.competencia === competencia,
  );
}

export function resumoDoMes(mes: {
  receitas: readonly Centavos[];
  linhas: readonly LinhaDaFatura[];
  faturas: readonly { total: Centavos; vencimento: DataLocal; paga: boolean }[];
  parcelasEmprestimos?: Centavos;
}) {
  const { meu, porTerceiro, total } = resumoDaFatura(mes.linhas);
  const emprestimos = mes.parcelasEmprestimos ?? 0;
  const renda = somar(mes.receitas);
  const abertas = mes.faturas.filter((f) => !f.paga && f.total > 0);
  return {
    renda,
    meusGastos: meu + emprestimos,
    saldoReal: saldoReal({
      receitas: mes.receitas,
      minhasParcelas: [meu],
      despesasFixas: [],
      parcelasEmprestimosTomados: [emprestimos],
    }),
    deTerceiros: total - meu,
    porTerceiro,
    precisoTerEmCaixa: somar(abertas.map((f) => f.total)),
    faturasAbertas: abertas.length,
    ultimoVencimento:
      abertas
        .map((f) => f.vencimento)
        .sort()
        .at(-1) ?? null,
  };
}

export function rendaComprometida(
  meses: readonly {
    competencia: Competencia;
    minhasParcelas: Centavos;
    assinaturas?: Centavos;
    emprestimos?: Centavos;
    renda: Centavos;
  }[],
): {
  competencia: Competencia;
  valor: Centavos;
  parcelas: Centavos;
  assinaturas: Centavos;
  emprestimos: Centavos;
  percentual: number | null;
}[] {
  return meses.map(({ competencia, minhasParcelas, assinaturas = 0, emprestimos = 0, renda }) => {
    const valor = minhasParcelas + assinaturas + emprestimos;
    return {
      competencia,
      valor,
      parcelas: minhasParcelas,
      assinaturas,
      emprestimos,
      percentual: renda > 0 ? Math.round((valor / renda) * 10_000) / 100 : null,
    };
  });
}
