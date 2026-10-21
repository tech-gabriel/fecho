import type { EmprestimosParaAlerta, FaturaParaAlerta } from './alertas';
import type { Assinatura } from './assinaturas';
import {
  type Competencia,
  type DataLocal,
  competenciaDe,
  dataNaCompetencia,
  somarDias,
  somarMeses,
  ultimoDia,
} from './competencia';
import { type DiasDoCartao, type StatusDaFatura, datasDaFatura, statusDaFatura } from './faturas';
import type { Centavos } from './money';

export type TipoDeEvento =
  'fechamento' | 'vencimento' | 'reembolso' | 'devolucao' | 'emprestimo' | 'assinatura';

export interface Evento {
  data: DataLocal;
  tipo: TipoDeEvento;
  cartaoId: number;
  competencia: Competencia;
  status?: StatusDaFatura;
  valor?: Centavos;
  terceiroId?: number;
  assinaturaId?: number;
  emprestimoId?: number;
  numero?: number;
}

const ORDEM: Record<TipoDeEvento, number> = {
  fechamento: 0,
  vencimento: 1,
  reembolso: 2,
  devolucao: 3,
  emprestimo: 4,
  assinatura: 5,
};

export function diasDaGrade(competencia: Competencia): { data: DataLocal; doMes: boolean }[] {
  const primeiro = dataNaCompetencia(competencia, 1);
  const domingo = new Date(`${primeiro}T00:00:00Z`).getUTCDay();
  const semanas = Math.max(5, Math.ceil((domingo + ultimoDia(competencia)) / 7));
  const inicio = somarDias(primeiro, -domingo);
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const data = somarDias(inicio, i);
    return { data, doMes: competenciaDe(data) === competencia };
  });
}

function mesesDoPeriodo(de: DataLocal, ate: DataLocal): Competencia[] {
  const meses: Competencia[] = [];
  for (let m = competenciaDe(de); m <= competenciaDe(ate); m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

export function eventosDoPeriodo({
  faturas,
  cartoes,
  assinaturas,
  de,
  ate,
  hoje,
  emprestimos = { parcelas: [], devolucoes: [] },
}: {
  emprestimos?: EmprestimosParaAlerta;
  faturas: readonly FaturaParaAlerta[];
  cartoes: readonly ({ id: number; ativo: boolean } & DiasDoCartao)[];
  assinaturas: readonly Assinatura[];
  de: DataLocal;
  ate: DataLocal;
  hoje: DataLocal;
}): Evento[] {
  const dentro = (data: DataLocal) => data >= de && data <= ate;
  const meses = mesesDoPeriodo(de, ate);
  const eventos: Evento[] = [];

  for (const cartao of cartoes.filter((c) => c.ativo)) {
    for (const competencia of meses) {
      const { fechamento } = datasDaFatura(competencia, cartao);
      if (dentro(fechamento)) {
        eventos.push({ data: fechamento, tipo: 'fechamento', cartaoId: cartao.id, competencia });
      }
    }
  }

  for (const fatura of faturas) {
    const { cartaoId, competencia, vencimento } = fatura;
    if (!dentro(vencimento)) continue;
    if (fatura.total > 0) {
      eventos.push({
        data: vencimento,
        tipo: 'vencimento',
        cartaoId,
        competencia,
        valor: fatura.total,
        status: statusDaFatura({ vencimento, pagoEm: fatura.paga ? vencimento : null }, hoje),
      });
    }
    if (vencimento >= hoje) continue;
    for (const { terceiroId, falta } of fatura.faltaPorTerceiro) {
      if (falta > 0) {
        eventos.push({
          data: vencimento,
          tipo: 'reembolso',
          cartaoId,
          competencia,
          terceiroId,
          valor: falta,
        });
      }
    }
  }

  for (const assinatura of assinaturas.filter((a) => a.ativa)) {
    for (const competencia of meses) {
      const data = dataNaCompetencia(competencia, assinatura.dia);
      if (competencia < assinatura.inicio || !dentro(data)) continue;
      eventos.push({
        data,
        tipo: 'assinatura',
        cartaoId: assinatura.cartaoId,
        competencia,
        assinaturaId: assinatura.id,
        valor: assinatura.valorCentavos,
      });
    }
  }

  for (const { emprestimoId, numero, vencimento, valor, paga } of emprestimos.parcelas) {
    if (!dentro(vencimento)) continue;
    eventos.push({
      data: vencimento,
      tipo: 'emprestimo',
      cartaoId: 0,
      competencia: competenciaDe(vencimento),
      emprestimoId,
      numero,
      valor,
      status: paga ? 'paga' : vencimento < hoje ? 'atrasada' : 'pendente',
    });
  }

  for (const { emprestimoId, terceiroId, prazo, falta } of emprestimos.devolucoes) {
    if (!dentro(prazo)) continue;
    eventos.push({
      data: prazo,
      tipo: 'devolucao',
      cartaoId: 0,
      competencia: competenciaDe(prazo),
      emprestimoId,
      terceiroId,
      valor: falta,
      status: falta <= 0 ? 'paga' : prazo < hoje ? 'atrasada' : 'pendente',
    });
  }

  return eventos.sort((a, b) => a.data.localeCompare(b.data) || ORDEM[a.tipo] - ORDEM[b.tipo]);
}
