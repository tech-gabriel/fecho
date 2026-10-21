import type { Alerta } from '@/domain/alertas';
import { somarMeses } from '@/domain/competencia';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';

const emDias = (dias: number) => (dias === 1 ? 'amanhã' : `em ${String(dias)} dias`);

export function textoDoAlerta(
  alerta: Alerta,
  nomes: {
    cartao: string;
    terceiro: string | undefined;
    assinatura?: string | undefined;
    emprestimo?: { descricao: string; numParcelas: number } | undefined;
  },
): string {
  const { cartao, terceiro, assinatura, emprestimo } = nomes;
  switch (alerta.tipo) {
    case 'reembolso':
      return `Faltam ${formatarMoeda(alerta.valor ?? 0)} de ${terceiro ?? ''} para fechar a fatura do ${cartao}`;
    case 'fechamento': {
      const proxima = nomeDoMes(somarMeses(alerta.competencia, 1)).split(' ')[0] ?? '';
      return `O ${cartao} fecha ${emDias(alerta.dias)}. Compras a partir de ${dataCurta(alerta.data)} entram na fatura de ${proxima}.`;
    }
    case 'vencimento':
      return `A fatura do ${cartao} vence ${alerta.dias === 0 ? 'hoje' : emDias(alerta.dias)}`;
    case 'assinatura':
      return `Amanhã: ${assinatura ?? ''}, ${formatarMoeda(alerta.valor ?? 0)} no ${cartao}`;
    case 'devolucao':
      return `${terceiro ?? ''} está ${String(-alerta.dias)} ${alerta.dias === -1 ? 'dia atrasado' : 'dias atrasado'} com os ${formatarMoeda(alerta.valor ?? 0)} que você emprestou`;
    case 'parcela-emprestimo': {
      const parcela = `A ${String(alerta.numero ?? 0)}ª parcela do ${emprestimo?.descricao ?? 'empréstimo'}`;
      return alerta.dias === 0
        ? `${parcela} vence hoje. Já foi debitada?`
        : `${parcela} venceu há ${String(-alerta.dias)} ${alerta.dias === -1 ? 'dia' : 'dias'} e não está marcada como paga`;
    }
    case 'atraso':
      return `A fatura do ${cartao} está atrasada há ${String(-alerta.dias)} ${alerta.dias === -1 ? 'dia' : 'dias'}`;
  }
}

export function quandoComecou(idade: number): string {
  if (idade <= 0) return 'hoje';
  return idade === 1 ? 'ontem' : `há ${String(idade)} dias`;
}
