import { describe, expect, it } from 'vitest';
import type { Assinatura } from './assinaturas';
import { diasDaGrade, eventosDoPeriodo } from './calendario';
import { somarDias } from './competencia';

const roxo = { id: 1, diaFechamento: 28, diaVencimento: 5, ativo: true };
const nuvem: Assinatura = {
  id: 4,
  nome: 'Nuvem 2 TB',
  cartaoId: 1,
  categoriaId: null,
  valorCentavos: 2_940,
  dia: 20,
  rateios: [],
  ativa: true,
  inicio: '2026-10',
};
const fatura = (extra = {}) => ({
  cartaoId: 1,
  competencia: '2026-10',
  vencimento: '2026-11-05',
  total: 50_000,
  paga: false,
  faltaPorTerceiro: [] as { terceiroId: number; falta: number }[],
  ...extra,
});
const base = { faturas: [], cartoes: [], assinaturas: [], hoje: '2026-10-20' };
const tipos = (eventos: ReturnType<typeof eventosDoPeriodo>) =>
  eventos.map((e) => [e.data, e.tipo, e.status]);

describe('somarDias', () => {
  it('soma e subtrai dias atravessando meses e anos', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('diasDaGrade', () => {
  it('começa no domingo e completa 5 semanas', () => {
    const dias = diasDaGrade('2026-10');
    expect(dias).toHaveLength(35);
    expect(dias[0]).toEqual({ data: '2026-09-27', doMes: false });
    expect(dias[4]).toEqual({ data: '2026-10-01', doMes: true });
    expect(dias.at(-1)).toEqual({ data: '2026-10-31', doMes: true });
  });

  it('usa 6 semanas quando o mês precisa', () => {
    const dias = diasDaGrade('2026-08');
    expect(dias).toHaveLength(42);
    expect(dias[6]).toEqual({ data: '2026-08-01', doMes: true });
  });

  it('nunca tem menos de 5 semanas', () => {
    expect(diasDaGrade('2026-02')).toHaveLength(35);
  });
});

describe('eventosDoPeriodo', () => {
  it('mostra os fechamentos dos cartões ativos, inclusive dia 31 em fevereiro', () => {
    const dia31 = { id: 2, diaFechamento: 31, diaVencimento: 10, ativo: true };
    const inativo = { ...roxo, id: 3, ativo: false };
    expect(
      tipos(
        eventosDoPeriodo({
          ...base,
          cartoes: [dia31, inativo],
          de: '2027-02-01',
          ate: '2027-02-28',
        }),
      ),
    ).toEqual([['2027-02-28', 'fechamento', undefined]]);
  });

  it('marca o vencimento como pendente, pago ou atrasado e ignora fatura vazia', () => {
    const periodo = { de: '2026-11-01', ate: '2026-11-30' };
    expect(
      eventosDoPeriodo({ ...base, ...periodo, faturas: [fatura()] }).map((e) => e.status),
    ).toEqual(['pendente']);
    expect(
      eventosDoPeriodo({ ...base, ...periodo, hoje: '2026-11-06', faturas: [fatura()] })[0]?.status,
    ).toBe('atrasada');
    expect(
      eventosDoPeriodo({ ...base, ...periodo, faturas: [fatura({ paga: true })] })[0]?.status,
    ).toBe('paga');
    expect(eventosDoPeriodo({ ...base, ...periodo, faturas: [fatura({ total: 0 })] })).toEqual([]);
  });

  it('põe a cobrança das assinaturas ativas que já começaram', () => {
    const eventos = eventosDoPeriodo({
      ...base,
      assinaturas: [
        nuvem,
        { ...nuvem, id: 5, ativa: false },
        { ...nuvem, id: 6, inicio: '2026-12' },
      ],
      de: '2026-10-01',
      ate: '2026-11-30',
    });
    expect(eventos.map((e) => [e.data, e.tipo, e.assinaturaId, e.valor])).toEqual([
      ['2026-10-20', 'assinatura', 4, 2_940],
      ['2026-11-20', 'assinatura', 4, 2_940],
    ]);
  });

  it('mostra o reembolso só depois do vencimento, com o que ainda falta', () => {
    const comFalta = fatura({ faltaPorTerceiro: [{ terceiroId: 7, falta: 32_000 }] });
    const periodo = { de: '2026-11-01', ate: '2026-11-30', faturas: [comFalta] };
    expect(eventosDoPeriodo({ ...base, ...periodo }).map((e) => e.tipo)).toEqual(['vencimento']);
    expect(
      eventosDoPeriodo({ ...base, ...periodo, hoje: '2026-11-06' }).map((e) => [
        e.tipo,
        e.terceiroId,
        e.valor,
      ]),
    ).toEqual([
      ['vencimento', undefined, 50_000],
      ['reembolso', 7, 32_000],
    ]);
  });

  it('ordena por data e, no mesmo dia, fechamento antes de vencimento', () => {
    const eventos = eventosDoPeriodo({
      ...base,
      cartoes: [{ ...roxo, diaFechamento: 5 }],
      faturas: [fatura()],
      assinaturas: [{ ...nuvem, dia: 1, inicio: '2026-11' }],
      de: '2026-11-01',
      ate: '2026-11-05',
    });
    expect(tipos(eventos)).toEqual([
      ['2026-11-01', 'assinatura', undefined],
      ['2026-11-05', 'fechamento', undefined],
      ['2026-11-05', 'vencimento', 'pendente'],
    ]);
  });

  it('cobre a virada de ano', () => {
    expect(
      tipos(
        eventosDoPeriodo({
          ...base,
          cartoes: [{ ...roxo, diaFechamento: 2 }],
          de: '2026-12-25',
          ate: '2027-01-05',
        }),
      ),
    ).toEqual([['2027-01-02', 'fechamento', undefined]]);
  });
});

describe('eventos de empréstimo', () => {
  const emprestimos = {
    parcelas: [
      { emprestimoId: 1, numero: 6, vencimento: '2026-10-10', valor: 48_000, paga: true },
      { emprestimoId: 1, numero: 7, vencimento: '2026-11-10', valor: 48_000, paga: false },
    ],
    devolucoes: [{ emprestimoId: 3, terceiroId: 8, prazo: '2026-10-15', falta: 80_000 }],
  };

  it('põe a parcela do empréstimo tomado e a devolução combinada', () => {
    const eventos = eventosDoPeriodo({
      ...base,
      emprestimos,
      de: '2026-10-01',
      ate: '2026-11-30',
    });
    expect(eventos.map((e) => [e.data, e.tipo, e.status, e.numero, e.terceiroId])).toEqual([
      ['2026-10-10', 'emprestimo', 'paga', 6, undefined],
      ['2026-10-15', 'devolucao', 'atrasada', undefined, 8],
      ['2026-11-10', 'emprestimo', 'pendente', 7, undefined],
    ]);
  });

  it('marca como atrasada a parcela vencida e a devolução que passou da data', () => {
    const eventos = eventosDoPeriodo({
      ...base,
      hoje: '2026-11-11',
      emprestimos,
      de: '2026-10-01',
      ate: '2026-11-30',
    });
    expect(eventos.map((e) => e.status)).toEqual(['paga', 'atrasada', 'atrasada']);
  });

  it('a devolução já paga aparece como paga', () => {
    const eventos = eventosDoPeriodo({
      ...base,
      emprestimos: {
        parcelas: [],
        devolucoes: emprestimos.devolucoes.map((d) => ({ ...d, falta: 0 })),
      },
      de: '2026-10-01',
      ate: '2026-10-31',
    });
    expect(eventos.map((e) => e.status)).toEqual(['paga']);
  });
});
