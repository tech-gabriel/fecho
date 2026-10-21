import { describe, expect, it } from 'vitest';
import { alertasDoDia, grupoDoAlerta, type FaturaParaAlerta, type TipoDeAlerta } from './alertas';

const roxo = { id: 1, diaFechamento: 28, diaVencimento: 5 };
const fatura = (extra: Partial<FaturaParaAlerta> = {}): FaturaParaAlerta => ({
  cartaoId: 1,
  competencia: '2026-10',
  vencimento: '2026-11-05',
  total: 50_000,
  paga: false,
  faltaPorTerceiro: [],
  ...extra,
});
const tipos = (alertas: ReturnType<typeof alertasDoDia>) => alertas.map((a) => a.tipo);

describe('alertasDoDia', () => {
  it('avisa que o cartão fecha de 1 a 3 dias antes do fechamento, mesmo sem compras', () => {
    expect(alertasDoDia([], [roxo], '2026-10-24')).toEqual([]);
    expect(alertasDoDia([], [roxo], '2026-10-25')).toEqual([
      {
        chave: 'fechamento:1:2026-10',
        tipo: 'fechamento',
        cartaoId: 1,
        competencia: '2026-10',
        data: '2026-10-28',
        dias: 3,
        idade: 0,
      },
    ]);
    expect(alertasDoDia([], [roxo], '2026-10-27')[0]).toMatchObject({ dias: 1, idade: 2 });
    expect(alertasDoDia([], [roxo], '2026-10-28')).toEqual([]);
  });

  it('usa o último dia do mês quando o fechamento não existe nele', () => {
    const dia31 = { id: 2, diaFechamento: 31, diaVencimento: 10 };
    expect(alertasDoDia([], [dia31], '2027-02-26')[0]).toMatchObject({
      competencia: '2027-02',
      data: '2027-02-28',
      dias: 2,
    });
  });

  it('vira o ano no fechamento', () => {
    const dia2 = { id: 3, diaFechamento: 2, diaVencimento: 10 };
    expect(alertasDoDia([], [dia2], '2026-12-30')[0]).toMatchObject({
      competencia: '2027-01',
      data: '2027-01-02',
      dias: 3,
    });
  });

  it('avisa o vencimento de 0 a 3 dias antes, inclusive no mês seguinte ao fechamento', () => {
    expect(alertasDoDia([fatura()], [], '2026-11-01')).toEqual([]);
    expect(alertasDoDia([fatura()], [], '2026-11-02')).toEqual([
      {
        chave: 'vencimento:1:2026-10',
        tipo: 'vencimento',
        cartaoId: 1,
        competencia: '2026-10',
        data: '2026-11-05',
        dias: 3,
        idade: 0,
      },
    ]);
    expect(alertasDoDia([fatura()], [], '2026-11-05')[0]).toMatchObject({ dias: 0, idade: 3 });
  });

  it('troca o vencimento por atraso depois do dia, por até 30 dias', () => {
    expect(alertasDoDia([fatura()], [], '2026-11-06')).toEqual([
      {
        chave: 'atraso:1:2026-10',
        tipo: 'atraso',
        cartaoId: 1,
        competencia: '2026-10',
        data: '2026-11-05',
        dias: -1,
        idade: 0,
      },
    ]);
    expect(alertasDoDia([fatura()], [], '2026-12-05')[0]).toMatchObject({ dias: -30, idade: 29 });
    expect(alertasDoDia([fatura()], [], '2026-12-06')).toEqual([]);
  });

  it('não avisa fatura paga nem fatura sem compras', () => {
    expect(alertasDoDia([fatura({ paga: true })], [], '2026-11-06')).toEqual([]);
    expect(alertasDoDia([fatura({ total: 0 })], [], '2026-11-06')).toEqual([]);
  });

  it('avisa o reembolso a partir de 5 dias antes do vencimento, por pessoa', () => {
    const comFalta = fatura({
      faltaPorTerceiro: [
        { terceiroId: 7, falta: 32_000 },
        { terceiroId: 8, falta: 0 },
      ],
    });
    expect(alertasDoDia([comFalta], [], '2026-10-30')).toEqual([]);
    expect(alertasDoDia([comFalta], [], '2026-10-31')).toEqual([
      {
        chave: 'reembolso:1:2026-10:7',
        tipo: 'reembolso',
        cartaoId: 1,
        competencia: '2026-10',
        terceiroId: 7,
        valor: 32_000,
        data: '2026-11-05',
        dias: 5,
        idade: 0,
      },
    ]);
    expect(tipos(alertasDoDia([comFalta], [], '2026-12-05'))).toEqual(['atraso', 'reembolso']);
    expect(alertasDoDia([comFalta], [], '2026-12-06')).toEqual([]);
    expect(alertasDoDia([{ ...comFalta, paga: true }], [], '2026-11-03')).toEqual([]);
  });

  it('ordena do mais novo para o mais antigo e deixa de fora os tipos desligados', () => {
    const comFalta = fatura({ faltaPorTerceiro: [{ terceiroId: 7, falta: 100 }] });
    const alertas = alertasDoDia([comFalta], [{ ...roxo, diaFechamento: 4 }], '2026-11-03');
    expect(alertas.map((a) => [a.tipo, a.idade])).toEqual([
      ['vencimento', 1],
      ['fechamento', 2],
      ['reembolso', 3],
    ]);
    expect(
      tipos(alertasDoDia([comFalta], [roxo], '2026-11-03', ['reembolso', 'fechamento'])),
    ).toEqual(['vencimento']);
  });
});

describe('grupoDoAlerta', () => {
  it('separa hoje, esta semana e antes pela idade do alerta', () => {
    expect(grupoDoAlerta(0)).toBe('Hoje');
    expect(grupoDoAlerta(1)).toBe('Esta semana');
    expect(grupoDoAlerta(6)).toBe('Esta semana');
    expect(grupoDoAlerta(7)).toBe('Antes');
  });
});

describe('alerta de assinatura', () => {
  const nuvem = {
    id: 4,
    nome: 'Nuvem 2 TB',
    cartaoId: 2,
    categoriaId: null,
    valorCentavos: 2_940,
    dia: 25,
    rateios: [],
    ativa: true,
    inicio: '2026-10',
  };

  it('avisa na véspera da cobrança', () => {
    expect(alertasDoDia([], [], '2026-10-23', [], [nuvem])).toEqual([]);
    expect(alertasDoDia([], [], '2026-10-24', [], [nuvem])).toEqual([
      {
        chave: 'assinatura:4:2026-10',
        tipo: 'assinatura',
        cartaoId: 2,
        competencia: '2026-10',
        assinaturaId: 4,
        valor: 2_940,
        data: '2026-10-25',
        dias: 1,
        idade: 0,
      },
    ]);
    expect(alertasDoDia([], [], '2026-10-25', [], [nuvem])).toEqual([]);
  });

  it('não avisa assinatura pausada nem desligada', () => {
    expect(alertasDoDia([], [], '2026-10-24', [], [{ ...nuvem, ativa: false }])).toEqual([]);
    expect(alertasDoDia([], [], '2026-10-24', ['assinatura'], [nuvem])).toEqual([]);
  });
});

describe('alertas de empréstimo', () => {
  const emprestimos = {
    devolucoes: [{ emprestimoId: 3, terceiroId: 8, prazo: '2026-10-15', falta: 80_000 }],
    parcelas: [
      { emprestimoId: 1, numero: 7, vencimento: '2026-11-10', valor: 48_000, paga: false },
      { emprestimoId: 1, numero: 6, vencimento: '2026-10-10', valor: 48_000, paga: true },
    ],
  };
  const doDia = (hoje: string, desligados: TipoDeAlerta[] = []) =>
    alertasDoDia([], [], hoje, desligados, [], emprestimos);

  it('avisa a devolução atrasada por até 30 dias', () => {
    const doDiaSo = (hoje: string) => doDia(hoje, ['parcela-emprestimo']);
    expect(doDiaSo('2026-10-15')).toEqual([]);
    expect(doDiaSo('2026-10-19')).toEqual([
      {
        chave: 'devolucao:3',
        tipo: 'devolucao',
        cartaoId: 0,
        competencia: '2026-10',
        emprestimoId: 3,
        terceiroId: 8,
        valor: 80_000,
        data: '2026-10-15',
        dias: -4,
        idade: 3,
      },
    ]);
    expect(doDiaSo('2026-11-14').map((a) => a.tipo)).toEqual(['devolucao']);
    expect(doDiaSo('2026-11-15').map((a) => a.tipo)).toEqual([]);
  });

  it('lembra a parcela no dia do débito até ser marcada, por até 30 dias', () => {
    expect(doDia('2026-11-09', ['devolucao'])).toEqual([]);
    expect(doDia('2026-11-10', ['devolucao'])).toEqual([
      {
        chave: 'parcela-emprestimo:1:7',
        tipo: 'parcela-emprestimo',
        cartaoId: 0,
        competencia: '2026-11',
        emprestimoId: 1,
        numero: 7,
        valor: 48_000,
        data: '2026-11-10',
        dias: 0,
        idade: 0,
      },
    ]);
    expect(doDia('2026-12-10', ['devolucao'])[0]?.idade).toBe(30);
    expect(doDia('2026-12-11', ['devolucao'])).toEqual([]);
  });
});
