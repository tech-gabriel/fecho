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
