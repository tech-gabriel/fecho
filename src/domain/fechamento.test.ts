import { describe, expect, it } from 'vitest';
import { dataDoSaldo, mesFechadoEntre, saldoDaFatura } from './fechamento';
import { competenciaDaCompra } from './faturas';

describe('saldoDaFatura', () => {
  it('é o que faltou pagar, nunca negativo', () => {
    expect(saldoDaFatura(100_000, 60_000)).toBe(40_000);
    expect(saldoDaFatura(100_000, 120_000)).toBe(0);
  });
});

describe('dataDoSaldo', () => {
  it('cai no dia do fechamento, para entrar na fatura seguinte', () => {
    const roxo = { diaFechamento: 28, diaVencimento: 5 };
    const data = dataDoSaldo(roxo, '2026-10');
    expect(data).toBe('2026-10-28');
    expect(competenciaDaCompra(data, roxo.diaFechamento)).toBe('2026-11');
  });

  it('usa o último dia quando o fechamento não existe no mês', () => {
    expect(dataDoSaldo({ diaFechamento: 31, diaVencimento: 10 }, '2027-02')).toBe('2027-02-28');
    expect(competenciaDaCompra('2027-02-28', 31)).toBe('2027-03');
  });
});

describe('mesFechadoEntre', () => {
  it('devolve o primeiro mês fechado entre as competências tocadas', () => {
    const fechados = new Set(['2026-09', '2026-10']);
    expect(mesFechadoEntre(['2026-11', '2026-10', '2026-09'], fechados)).toBe('2026-09');
    expect(mesFechadoEntre(['2026-11', '2026-12'], fechados)).toBeNull();
  });
});
