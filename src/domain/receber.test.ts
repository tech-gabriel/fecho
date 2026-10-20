import { describe, expect, it } from 'vitest';
import {
  distribuir,
  itensDaPessoa,
  mensagemDeCobranca,
  situacaoDaPessoa,
  sugerirAbatimento,
} from './receber';

const ana = 7;
const cartoes = [{ id: 1, diaFechamento: 28, diaVencimento: 5 }];
const parcela = (extra: Partial<Parameters<typeof itensDaPessoa>[0][number]>) => ({
  compraId: 1,
  numero: 1,
  numParcelas: 1,
  descricao: 'Compra',
  dataCompra: '2026-10-02',
  cartaoId: 1,
  competencia: '2026-10',
  valorCentavos: 10_000,
  rateios: [{ terceiroId: ana, percentual: 100 }],
  ...extra,
});

describe('itensDaPessoa', () => {
  it('pega a parte da pessoa em cada parcela, com o vencimento da fatura', () => {
    const itens = itensDaPessoa(
      [
        parcela({
          compraId: 1,
          valorCentavos: 21_651,
          rateios: [
            { terceiroId: null, percentual: 50 },
            { terceiroId: ana, percentual: 50 },
          ],
        }),
        parcela({ compraId: 2, rateios: [{ terceiroId: 8, percentual: 100 }] }),
        parcela({ compraId: 3, competencia: '2026-09' }),
      ],
      ana,
      cartoes,
    );

    expect(itens.map((i) => [i.chave, i.valor, i.vencimento])).toEqual([
      ['1:1', 10_825, '2026-11-05'],
      ['3:1', 10_000, '2026-10-05'],
    ]);
  });
});

describe('situacaoDaPessoa', () => {
  const itens = itensDaPessoa(
    [
      parcela({ compraId: 1, competencia: '2026-09', valorCentavos: 15_000 }),
      parcela({ compraId: 2, competencia: '2026-10', valorCentavos: 32_000 }),
    ],
    ana,
    cartoes,
  );

  it('soma o acumulado, abate o que foi escolhido e acha o prazo mais antigo em aberto', () => {
    const s = situacaoDaPessoa(
      itens,
      [{ valor: 20_000, abatimentos: [{ compraId: 2, numero: 1, valor: 20_000 }] }],
      '2026-10-20',
    );

    expect(s).toMatchObject({
      total: 47_000,
      depositado: 20_000,
      falta: 27_000,
      credito: 0,
      prazo: '2026-10-05',
      status: 'atrasado',
    });
    expect(s.itens.map((i) => [i.chave, i.abatido, i.aberto, i.status])).toEqual([
      ['1:1', 0, 15_000, 'atrasado'],
      ['2:1', 20_000, 12_000, 'parcial'],
    ]);
  });

  it('tudo quitado é Pago e o excesso vira crédito', () => {
    const s = situacaoDaPessoa(
      itens,
      [
        {
          valor: 50_000,
          abatimentos: [
            { compraId: 1, numero: 1, valor: 15_000 },
            { compraId: 2, numero: 1, valor: 32_000 },
          ],
        },
      ],
      '2026-10-20',
    );
    expect(s).toMatchObject({ falta: 0, credito: 3_000, status: 'pago', prazo: null });
    expect(s.itens.every((i) => i.status === 'pago')).toBe(true);
  });

  it('sem depósito e antes do vencimento é Pendente', () => {
    expect(situacaoDaPessoa(itens.slice(1), [], '2026-10-20').status).toBe('pendente');
  });
});

describe('sugerirAbatimento e distribuir', () => {
  const abertos = [
    { chave: '2:1', compraId: 2, numero: 1, vencimento: '2026-11-05', aberto: 32_000 },
    { chave: '1:1', compraId: 1, numero: 1, vencimento: '2026-10-05', aberto: 15_000 },
    { chave: '3:2', compraId: 3, numero: 2, vencimento: '2026-12-05', aberto: 5_000 },
  ];

  it('marca da que vence primeiro até cobrir o valor', () => {
    expect(sugerirAbatimento(abertos, 20_000)).toEqual(['1:1', '2:1']);
    expect(sugerirAbatimento(abertos, 15_000)).toEqual(['1:1']);
    expect(sugerirAbatimento(abertos, 0)).toEqual([]);
  });

  it('distribui na ordem do vencimento e devolve a sobra', () => {
    expect(
      distribuir(
        20_000,
        abertos.filter((a) => a.chave !== '3:2'),
      ),
    ).toEqual({
      abatimentos: [
        { compraId: 1, numero: 1, valor: 15_000 },
        { compraId: 2, numero: 1, valor: 5_000 },
      ],
      sobra: 0,
    });
    expect(distribuir(20_000, [abertos[2] as (typeof abertos)[number]])).toEqual({
      abatimentos: [{ compraId: 3, numero: 2, valor: 5_000 }],
      sobra: 15_000,
    });
  });
});

describe('mensagemDeCobranca', () => {
  it('troca as variáveis, com ou sem acento em {cartão}', () => {
    expect(
      mensagemDeCobranca(
        'Oi, {nome}! Faltam {valor} no {cartão}/{cartao}, vence {vencimento}. Pix: {pix}',
        {
          nome: 'Ana',
          valor: 'R$ 320,00',
          cartao: 'Cartão Roxo',
          vencimento: '05/11',
          pix: 'eu@email.com',
        },
      ),
    ).toBe('Oi, Ana! Faltam R$ 320,00 no Cartão Roxo/Cartão Roxo, vence 05/11. Pix: eu@email.com');
  });
});
