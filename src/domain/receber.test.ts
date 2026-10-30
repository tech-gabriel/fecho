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

  it('empréstimo sem cartão usa o texto próprio de empréstimo', () => {
    expect(
      mensagemDeCobranca('Oi, {nome}! Faltam {valor} das suas compras no meu {cartão}.', {
        nome: 'Ana',
        valor: 'R$ 500,00',
        cartao: null,
        vencimento: '12/11',
        pix: 'eu@email.com',
      }),
    ).toBe(
      'Oi, Ana! Faltam R$ 500,00 do empréstimo, que combinamos para 12/11. Meu Pix: eu@email.com',
    );
  });
});

describe('empréstimo concedido em A receber', () => {
  const emprestimo = {
    chave: 'e:3',
    emprestimoId: 3,
    compraId: 0,
    numero: 1,
    numParcelas: 1,
    descricao: 'Empréstimo',
    dataCompra: '2026-08-15',
    cartaoId: 0,
    competencia: '2026-10',
    vencimento: '2026-10-15',
    valor: 80_000,
  };

  it('abate o empréstimo pelo depósito e atrasa depois da data combinada', () => {
    const situacao = situacaoDaPessoa(
      [emprestimo],
      [{ valor: 30_000, abatimentos: [{ emprestimoId: 3, valor: 30_000 }] }],
      '2026-10-19',
    );
    expect(situacao.itens[0]).toMatchObject({
      abatido: 30_000,
      aberto: 50_000,
      status: 'atrasado',
    });
    expect(situacao).toMatchObject({ falta: 50_000, status: 'atrasado' });
  });

  it('distribui o depósito entre parcela e empréstimo escolhidos', () => {
    expect(
      distribuir(90_000, [
        { ...emprestimo, aberto: 80_000 },
        { chave: '1:1', compraId: 1, numero: 1, vencimento: '2026-11-05', aberto: 20_000 },
      ]),
    ).toEqual({
      abatimentos: [
        { emprestimoId: 3, valor: 80_000 },
        { compraId: 1, numero: 1, valor: 10_000 },
      ],
      sobra: 0,
    });
  });
});

describe('conta fixa dividida em A receber', () => {
  const aluguel = {
    chave: 'f:4:2026-10',
    contaFixaId: 4,
    compraId: 0,
    numero: 1,
    numParcelas: 1,
    descricao: 'Aluguel',
    dataCompra: '2026-10-10',
    cartaoId: 0,
    competencia: '2026-10',
    vencimento: '2026-10-10',
    valor: 90_000,
  };

  it('abate a parte da conta do mês pelo depósito', () => {
    const situacao = situacaoDaPessoa(
      [aluguel],
      [{ valor: 90_000, abatimentos: [{ contaFixaId: 4, competencia: '2026-10', valor: 90_000 }] }],
      '2026-10-19',
    );
    expect(situacao).toMatchObject({ falta: 0, status: 'pago' });
  });

  it('distribui o depósito para a conta com a competência', () => {
    expect(distribuir(50_000, [{ ...aluguel, aberto: 90_000 }])).toEqual({
      abatimentos: [{ contaFixaId: 4, competencia: '2026-10', valor: 50_000 }],
      sobra: 0,
    });
  });

  it('cobrança só de conta usa o texto da conta', () => {
    expect(
      mensagemDeCobranca('Modelo das compras no {cartão}', {
        nome: 'Bia',
        valor: 'R$ 900,00',
        cartao: null,
        conta: 'Aluguel',
        vencimento: '10/10',
        pix: 'eu@pix',
      }),
    ).toBe(
      'Oi, Bia! Faltam R$ 900,00 da sua parte da conta Aluguel, que vence em 10/10. Meu Pix: eu@pix',
    );
  });
});
