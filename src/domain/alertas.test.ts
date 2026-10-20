import { describe, expect, it } from 'vitest';
import { alertasDoDia, grupoDoAlerta, type FaturaParaAlerta } from './alertas';

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
