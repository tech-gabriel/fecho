import { describe, expect, it } from 'vitest';
import {
  alertasDeContas,
  contasComoGastos,
  contasDoMes,
  minhaParteDasContas,
  type ContaFixa,
  type PagamentoDeConta,
} from './contasFixas';

const conta = (extra: Partial<ContaFixa> = {}): ContaFixa => ({
  id: 1,
  descricao: 'Aluguel',
  categoriaId: null,
  valorCentavos: 180_000,
  dia: 10,
  inicio: '2026-01',
  ativa: true,
  rateios: [],
  ...extra,
});
const luz = conta({ id: 2, descricao: 'Luz', valorCentavos: 15_000, dia: 31 });
const pago = (extra: Partial<PagamentoDeConta> = {}): PagamentoDeConta => ({
  contaId: 2,
  competencia: '2026-02',
  valorCentavos: 18_700,
  pagoEm: '2026-02-25',
  ...extra,
});

describe('contasDoMes', () => {
  it('vence no dia da conta, no último dia em fevereiro, e usa o valor pago quando houver', () => {
    const itens = contasDoMes([conta(), luz], [pago()], '2026-02', '2026-02-12');

    expect(itens.map((i) => [i.conta.id, i.vencimento, i.valor, i.ajustado, i.status])).toEqual([
      [1, '2026-02-10', 180_000, false, 'atrasada'],
      [2, '2026-02-28', 18_700, true, 'paga'],
    ]);
  });

  it('fica pendente até o dia do vencimento, inclusive', () => {
    expect(contasDoMes([conta()], [], '2026-02', '2026-02-10')[0]?.status).toBe('pendente');
  });

  it('não entra antes do início nem arquivada sem pagamento no mês', () => {
    const futura = conta({ id: 3, inicio: '2026-03' });
    const arquivada = conta({ id: 4, ativa: false });
    const arquivadaPaga = conta({ id: 5, ativa: false });

    const ids = contasDoMes(
      [futura, arquivada, arquivadaPaga],
      [pago({ contaId: 5 })],
      '2026-02',
      '2026-02-01',
    ).map((i) => i.conta.id);

    expect(ids).toEqual([5]);
  });

  it('atravessa a virada do ano', () => {
    expect(
      contasDoMes([conta({ inicio: '2026-12' })], [], '2027-01', '2027-01-01')[0]?.vencimento,
    ).toBe('2027-01-10');
  });
});

describe('minhaParteDasContas', () => {
  it('soma só a minha parte de cada conta', () => {
    const dividida = conta({
      rateios: [
        { terceiroId: null, percentual: 50 },
        { terceiroId: 7, percentual: 50 },
      ],
    });
    const itens = contasDoMes([dividida, luz], [], '2026-03', '2026-03-01');

    expect(minhaParteDasContas(itens)).toBe(90_000 + 15_000);
  });
});

describe('alertasDeContas', () => {
  it('avisa no vencimento e enquanto estiver atrasada, até 30 dias', () => {
    const alertas = alertasDeContas([conta(), luz], [], '2026-03-10');

    expect(alertas).toEqual([
      {
        chave: 'conta:1:2026-03',
        tipo: 'conta-fixa',
        cartaoId: 0,
        contaId: 1,
        competencia: '2026-03',
        valor: 180_000,
        data: '2026-03-10',
        dias: 0,
        idade: 0,
      },
      {
        chave: 'conta:2:2026-02',
        tipo: 'conta-fixa',
        cartaoId: 0,
        contaId: 2,
        competencia: '2026-02',
        valor: 15_000,
        data: '2026-02-28',
        dias: -10,
        idade: 10,
      },
      {
        chave: 'conta:1:2026-02',
        tipo: 'conta-fixa',
        cartaoId: 0,
        contaId: 1,
        competencia: '2026-02',
        valor: 180_000,
        data: '2026-02-10',
        dias: -28,
        idade: 28,
      },
    ]);
  });

  it('não avisa o que já foi pago, o que ainda não venceu nem atraso de mais de 30 dias', () => {
    expect(alertasDeContas([luz], [pago()], '2026-03-05')).toEqual([]);
    expect(alertasDeContas([conta({ inicio: '2026-03' })], [], '2026-03-09')).toEqual([]);
    expect(
      alertasDeContas([conta({ inicio: '2026-02' })], [], '2026-03-09').map((a) => a.chave),
    ).toEqual(['conta:1:2026-02']);
    expect(
      alertasDeContas([conta({ inicio: '2026-01', dia: 1 })], [], '2026-03-01').map((a) => a.chave),
    ).toEqual(['conta:1:2026-03', 'conta:1:2026-02']);
  });
});

describe('contasComoGastos', () => {
  it('vira gasto na categoria da conta só até o mês de hoje', () => {
    const casa = conta({ categoriaId: 4 });

    expect(contasComoGastos([casa, luz], [pago()], '2026-02', '2026-03-05')).toEqual([
      { categoriaId: 4, valorCentavos: 180_000, rateios: [] },
      { categoriaId: null, valorCentavos: 18_700, rateios: [] },
    ]);
    expect(contasComoGastos([casa], [], '2026-04', '2026-03-05')).toEqual([]);
  });
});
