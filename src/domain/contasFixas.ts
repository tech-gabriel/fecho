import type { Alerta } from './alertas';
import {
  type Competencia,
  type DataLocal,
  competenciaDe,
  dataNaCompetencia,
  diasEntre,
  somarMeses,
} from './competencia';
import type { Centavos } from './money';
import { chaveDaConta, type ItemDevido } from './receber';
import { ratear, type Rateio } from './terceiros';

export interface ContaFixa {
  id: number;
  descricao: string;
  categoriaId: number | null;
  valorCentavos: Centavos;
  dia: number;
  inicio: Competencia;
  ativa: boolean;
  rateios: Rateio[];
}

export interface PagamentoDeConta {
  contaId: number;
  competencia: Competencia;
  valorCentavos: Centavos;
  pagoEm: DataLocal;
}

export type StatusDaConta = 'paga' | 'pendente' | 'atrasada';

export interface ContaDoMes {
  conta: ContaFixa;
  competencia: Competencia;
  vencimento: DataLocal;
  valor: Centavos;
  ajustado: boolean;
  pagamento: PagamentoDeConta | undefined;
  status: StatusDaConta;
}

export const DIAS_DE_ATRASO_DA_CONTA = 30;

export function contasDoMes(
  contas: readonly ContaFixa[],
  pagamentos: readonly PagamentoDeConta[],
  competencia: Competencia,
  hoje: DataLocal,
): ContaDoMes[] {
  return contas.flatMap((conta) => {
    const pagamento = pagamentos.find(
      (p) => p.contaId === conta.id && p.competencia === competencia,
    );
    if (conta.inicio > competencia || (!conta.ativa && !pagamento)) return [];
    const vencimento = dataNaCompetencia(competencia, conta.dia);
    const valor = pagamento?.valorCentavos ?? conta.valorCentavos;
    return [
      {
        conta,
        competencia,
        vencimento,
        valor,
        ajustado: valor !== conta.valorCentavos,
        pagamento,
        status: pagamento ? 'paga' : hoje > vencimento ? 'atrasada' : 'pendente',
      },
    ];
  });
}

export const minhaParteDasContas = (itens: readonly ContaDoMes[]): Centavos =>
  itens.reduce((soma, i) => soma + ratear(i.valor, i.conta.rateios).meu, 0);

export function alertasDeContas(
  contas: readonly ContaFixa[],
  pagamentos: readonly PagamentoDeConta[],
  hoje: DataLocal,
): Alerta[] {
  const atual = competenciaDe(hoje);
  return [atual, somarMeses(atual, -1)]
    .flatMap((competencia) => contasDoMes(contas, pagamentos, competencia, hoje))
    .flatMap((item): Alerta[] => {
      const dias = diasEntre(hoje, item.vencimento);
      if (item.pagamento || dias > 0 || -dias > DIAS_DE_ATRASO_DA_CONTA) return [];
      return [
        {
          chave: `conta:${String(item.conta.id)}:${item.competencia}`,
          tipo: 'conta-fixa',
          cartaoId: 0,
          contaId: item.conta.id,
          competencia: item.competencia,
          valor: item.valor,
          data: item.vencimento,
          dias,
          idade: Math.max(-dias, 0),
        },
      ];
    })
    .sort((a, b) => a.idade - b.idade);
}

export const contasParaResumo = (itens: readonly ContaDoMes[]) => ({
  minhaParte: minhaParteDasContas(itens),
  pendentes: itens
    .filter((i) => !i.pagamento)
    .map((i) => ({ valor: i.valor, vencimento: i.vencimento })),
});

// meses futuros ficam de fora: o relatório mostra o que já aconteceu
export function contasComoGastos(
  contas: readonly ContaFixa[],
  pagamentos: readonly PagamentoDeConta[],
  competencia: Competencia,
  hoje: DataLocal,
) {
  if (competencia > competenciaDe(hoje)) return [];
  return contasDoMes(contas, pagamentos, competencia, hoje).map((i) => ({
    categoriaId: i.conta.categoriaId,
    valorCentavos: i.valor,
    rateios: i.conta.rateios,
  }));
}

export function itensDasContas(
  contas: readonly ContaFixa[],
  pagamentos: readonly PagamentoDeConta[],
  ate: Competencia,
  terceiroId: number,
): ItemDevido[] {
  return contas.flatMap((conta) => {
    if (!conta.rateios.some((r) => r.terceiroId === terceiroId)) return [];
    const itens: ItemDevido[] = [];
    for (
      let competencia = conta.inicio;
      competencia <= ate;
      competencia = somarMeses(competencia, 1)
    ) {
      const [item] = contasDoMes([conta], pagamentos, competencia, dataNaCompetencia(ate, 31));
      const valor = item ? (ratear(item.valor, conta.rateios).porTerceiro.get(terceiroId) ?? 0) : 0;
      if (!item || valor <= 0) continue;
      itens.push({
        chave: chaveDaConta(conta.id, competencia),
        contaFixaId: conta.id,
        compraId: 0,
        numero: 1,
        numParcelas: 1,
        descricao: conta.descricao,
        dataCompra: item.vencimento,
        cartaoId: 0,
        competencia,
        vencimento: item.vencimento,
        valor,
      });
    }
    return itens;
  });
}
