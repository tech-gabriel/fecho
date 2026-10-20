import { describe, expect, it } from 'vitest';
import {
  cobrancasAGerar,
  compraDaCobranca,
  projecaoDeAssinaturas,
  proximaCobranca,
  resumoDasAssinaturas,
  type Assinatura,
} from './assinaturas';

const assinatura = (extra: Partial<Assinatura> = {}): Assinatura => ({
  id: 1,
  nome: 'Nuvem 2 TB',
  cartaoId: 1,
  categoriaId: null,
  valorCentavos: 2_940,
  dia: 25,
  rateios: [],
  ativa: true,
  inicio: '2026-10',
  ...extra,
});

describe('cobrancasAGerar', () => {
  it('gera a cobrança do mês de hoje com a data do dia de cobrança, mesmo futura', () => {
    expect(cobrancasAGerar([assinatura()], new Set(), '2026-10-20')).toEqual({
      doMes: [{ assinatura: assinatura(), mes: '2026-10', dataCompra: '2026-10-25' }],
      atrasadas: [],
    });
  });

  it('não gera de novo um mês já gerado', () => {
    expect(cobrancasAGerar([assinatura()], new Set(['1:2026-10']), '2026-10-20').doMes).toEqual([]);
  });

  it('separa os meses passados não gerados, do início até o mês anterior', () => {
    const { doMes, atrasadas } = cobrancasAGerar(
      [assinatura({ inicio: '2026-11' })],
      new Set(['1:2026-12']),
      '2027-02-10',
    );
    expect(doMes.map((c) => c.dataCompra)).toEqual(['2027-02-25']);
    expect(atrasadas.map((c) => c.dataCompra)).toEqual(['2026-11-25', '2027-01-25']);
  });

  it('usa o último dia do mês quando o dia de cobrança não existe nele', () => {
    const { doMes } = cobrancasAGerar(
      [assinatura({ dia: 31, inicio: '2027-02' })],
      new Set(),
      '2027-02-01',
    );
    expect(doMes[0]?.dataCompra).toBe('2027-02-28');
  });

  it('não gera assinatura pausada nem com início no futuro', () => {
    expect(
      cobrancasAGerar(
        [assinatura({ ativa: false }), assinatura({ id: 2, inicio: '2026-11' })],
        new Set(),
        '2026-10-20',
      ),
    ).toEqual({ doMes: [], atrasadas: [] });
  });
});

describe('proximaCobranca', () => {
  it('é neste mês se o dia ainda não passou, inclusive hoje', () => {
    expect(proximaCobranca(assinatura(), '2026-10-25')).toBe('2026-10-25');
    expect(proximaCobranca(assinatura(), '2026-10-26')).toBe('2026-11-25');
  });

  it('vira o ano e respeita o início no futuro', () => {
    expect(proximaCobranca(assinatura(), '2026-12-26')).toBe('2027-01-25');
    expect(proximaCobranca(assinatura({ inicio: '2027-03' }), '2026-12-01')).toBe('2027-03-25');
  });
});

describe('resumoDasAssinaturas', () => {
  it('soma só as ativas, por mês e por ano, e mede o peso na renda', () => {
    expect(
      resumoDasAssinaturas(
        [
          assinatura({ valorCentavos: 20_000 }),
          assinatura({ id: 2, valorCentavos: 11_000 }),
          assinatura({ id: 3, valorCentavos: 5_000, ativa: false }),
        ],
        720_000,
      ),
    ).toEqual({ porMes: 31_000, porAno: 372_000, ativas: 2, percentualDaRenda: 4.3 });
  });

  it('não calcula percentual sem renda', () => {
    expect(resumoDasAssinaturas([assinatura()], 0).percentualDaRenda).toBeNull();
  });
});

describe('projecaoDeAssinaturas', () => {
  it('soma a minha parte das ativas que já começaram no mês', () => {
    expect(
      projecaoDeAssinaturas(
        [
          assinatura({
            valorCentavos: 2_941,
            rateios: [
              { terceiroId: null, percentual: 50 },
              { terceiroId: 7, percentual: 50 },
            ],
          }),
          assinatura({ id: 2, valorCentavos: 1_000, inicio: '2026-12' }),
          assinatura({ id: 3, valorCentavos: 1_000, ativa: false }),
        ],
        '2026-11',
        new Set(),
        [{ id: 1, diaFechamento: 31 }],
      ),
    ).toBe(1_471);
  });
});

describe('compraDaCobranca', () => {
  it('vira uma compra à vista, recorrente, ligada à assinatura e ao mês', () => {
    const nuvem = assinatura({ categoriaId: 3, rateios: [{ terceiroId: 7, percentual: 100 }] });
    expect(
      compraDaCobranca({ assinatura: nuvem, mes: '2026-10', dataCompra: '2026-10-25' }),
    ).toEqual({
      cartaoId: 1,
      descricao: 'Nuvem 2 TB',
      categoriaId: 3,
      valorTotal: 2_940,
      numParcelas: 1,
      dataCompra: '2026-10-25',
      recorrente: true,
      rateios: [{ terceiroId: 7, percentual: 100 }],
      assinatura: { id: 1, mes: '2026-10' },
    });
  });
});

describe('projecaoDeAssinaturas com meses gerados', () => {
  it('não conta de novo o mês que já virou compra', () => {
    expect(
      projecaoDeAssinaturas([assinatura()], '2026-11', new Set(['1:2026-11']), [
        { id: 1, diaFechamento: 31 },
      ]),
    ).toBe(0);
    expect(
      projecaoDeAssinaturas([assinatura()], '2026-12', new Set(['1:2026-11']), [
        { id: 1, diaFechamento: 31 },
      ]),
    ).toBe(2_940);
  });
});

describe('projecaoDeAssinaturas pela fatura', () => {
  const azul = { id: 1, diaFechamento: 3 };

  it('conta a cobrança na fatura em que ela cai, pelo fechamento do cartão', () => {
    const nuvem = [assinatura({ dia: 25 })];
    const geradas = new Set(['1:2026-10']);
    expect(projecaoDeAssinaturas(nuvem, '2026-11', geradas, [azul])).toBe(0);
    expect(projecaoDeAssinaturas(nuvem, '2026-12', geradas, [azul])).toBe(2_940);
  });

  it('sem o cartão, ignora a assinatura', () => {
    expect(projecaoDeAssinaturas([assinatura()], '2026-11', new Set(), [])).toBe(0);
  });
});
