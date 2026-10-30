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
    categoria?: string | undefined;
    conta?: string | undefined;
    emprestimo?: { descricao: string; numParcelas: number } | undefined;
  },
): string {
  const { cartao, terceiro, assinatura, emprestimo, categoria, conta } = nomes;
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
    case 'fechar-mes': {
      const mes = nomeDoMes(alerta.competencia).split(' ')[0] ?? '';
      if (alerta.dias < 0) return `${mes} ainda não foi fechado. Que tal conferir as faturas?`;
      const quando =
        alerta.dias === 0
          ? 'hoje'
          : alerta.dias === 1
            ? 'amanhã'
            : `em ${String(alerta.dias)} dias`;
      return `${mes} fecha ${quando}. Que tal começar a conferir as faturas?`;
    }
    case 'orcamento': {
      const mes = nomeDoMes(alerta.competencia).split(' ')[0] ?? '';
      const gasto = alerta.valor ?? 0;
      const limite = alerta.limite ?? 1;
      const valores = `${formatarMoeda(gasto)} de ${formatarMoeda(limite)}`;
      return gasto > limite
        ? `${categoria ?? ''} passou do limite de ${mes}: ${valores}`
        : `${categoria ?? ''} chegou a ${String(Math.floor((gasto * 100) / limite))}% do limite de ${mes}: ${valores}`;
    }
    case 'conta-fixa': {
      const nome = conta ?? 'Conta fixa';
      if (alerta.dias === 0) return `${nome} vence hoje: ${formatarMoeda(alerta.valor ?? 0)}`;
      const dias = -alerta.dias;
      return `${nome} venceu há ${String(dias)} ${dias === 1 ? 'dia' : 'dias'} e não está marcada como paga`;
    }
    case 'atraso':
      return `A fatura do ${cartao} está atrasada há ${String(-alerta.dias)} ${alerta.dias === -1 ? 'dia' : 'dias'}`;
  }
}

export function quandoComecou(idade: number): string {
  if (idade <= 0) return 'hoje';
  return idade === 1 ? 'ontem' : `há ${String(idade)} dias`;
}
