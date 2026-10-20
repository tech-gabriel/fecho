import { describe, expect, it } from 'vitest';
import { prepararNovaCompra, previaDaCompra, rateioDaCompra, sugerirCategoria } from './compras';

const cartaoRoxo = { diaFechamento: 28 };
const base = {
  cartaoId: 1,
  descricao: '  Mercado Pão de Açúcar ',
  categoriaId: 2,
  valorTotal: 64_950,
  numParcelas: 3,
  dataCompra: '2026-10-19',
  recorrente: false,
  rateios: [],
};

describe('prepararNovaCompra', () => {
  it('normaliza a compra e gera as parcelas pelo fechamento do cartão', () => {
    const { compra, rateios, parcelas } = prepararNovaCompra(base, cartaoRoxo);

    expect(compra).toEqual({
      cartaoId: 1,
      descricao: 'Mercado Pão de Açúcar',
      categoriaId: 2,
      valorTotalCentavos: 64_950,
      numParcelas: 3,
      dataCompra: '2026-10-19',
      recorrente: false,
      observacao: null,
      assinaturaId: null,
      assinaturaMes: null,
    });
    expect(rateios).toEqual([]);
    expect(parcelas.map((p) => [p.numero, p.competencia, p.valorCentavos])).toEqual([
      [1, '2026-10', 21_650],
      [2, '2026-11', 21_650],
      [3, '2026-12', 21_650],
    ]);
  });

  it('guarda o rateio com terceiros', () => {
    const rateios = [
      { terceiroId: null, percentual: 50 },
      { terceiroId: 7, percentual: 50 },
    ];
    expect(prepararNovaCompra({ ...base, rateios }, cartaoRoxo).rateios).toEqual(rateios);
  });

  it('trata "100% meu" como compra sem rateio', () => {
    expect(
      prepararNovaCompra({ ...base, rateios: [{ terceiroId: null, percentual: 100 }] }, cartaoRoxo)
        .rateios,
    ).toEqual([]);
  });

  it('aceita compra sem categoria', () => {
    expect(prepararNovaCompra({ ...base, categoriaId: null }, cartaoRoxo).compra.categoriaId).toBe(
      null,
    );
  });

  it.each(['', '   '])('rejeita descrição vazia (%j)', (descricao) => {
    expect(() => prepararNovaCompra({ ...base, descricao }, cartaoRoxo)).toThrow(
      'Digite uma descrição',
    );
  });

  it('propaga as validações de valor, parcelas e rateio', () => {
    expect(() => prepararNovaCompra({ ...base, valorTotal: 0 }, cartaoRoxo)).toThrow(
      'Digite um valor maior que zero',
    );
    expect(() => prepararNovaCompra({ ...base, numParcelas: 30 }, cartaoRoxo)).toThrow(
      'O máximo é 24 parcelas',
    );
    expect(() =>
      prepararNovaCompra({ ...base, rateios: [{ terceiroId: 7, percentual: 40 }] }, cartaoRoxo),
    ).toThrow('Os percentuais devem somar 100');
  });
});

describe('observação', () => {
  it('guarda o texto aparado e troca vazio por null', () => {
    expect(
      prepararNovaCompra({ ...base, observacao: '  presente da Ana ' }, cartaoRoxo).compra
        .observacao,
    ).toBe('presente da Ana');
    expect(
      prepararNovaCompra({ ...base, observacao: '   ' }, cartaoRoxo).compra.observacao,
    ).toBeNull();
  });
});

describe('sugerirCategoria', () => {
  const categorias = [
    { id: 1, nome: 'Mercado', ativo: true },
    { id: 2, nome: 'Transporte', ativo: true },
    { id: 3, nome: 'Saúde', ativo: true },
    { id: 4, nome: 'Lazer', ativo: false },
    { id: 5, nome: 'Casa', ativo: true },
  ];

  it('usa a categoria da compra mais recente com a mesma primeira palavra', () => {
    const historico = [
      { descricao: 'Uber para casa', categoriaId: 5 },
      { descricao: 'Uber aeroporto', categoriaId: 2 },
    ];
    expect(sugerirCategoria('uber centro', historico, categorias)).toBe(5);
  });

  it('ignora acento e maiúscula na comparação', () => {
    expect(
      sugerirCategoria('Açougue', [{ descricao: 'acougue do zé', categoriaId: 1 }], categorias),
    ).toBe(1);
  });

  it('sem histórico, usa a lista de palavras pelo nome da categoria', () => {
    expect(sugerirCategoria('Supermercado Dia', [], categorias)).toBe(1);
    expect(sugerirCategoria('Drogasil', [], categorias)).toBe(3);
    expect(sugerirCategoria('99 Pop', [], categorias)).toBe(2);
  });

  it('não sugere categoria arquivada nem descrição desconhecida', () => {
    expect(
      sugerirCategoria('Cinema', [{ descricao: 'cinema', categoriaId: 4 }], categorias),
    ).toBeNull();
    expect(sugerirCategoria('Xyz', [], categorias)).toBeNull();
    expect(sugerirCategoria('   ', [], categorias)).toBeNull();
  });
});

describe('rateioDaCompra', () => {
  it('minha compra não tem rateio', () => {
    expect(rateioDaCompra('minha', [])).toEqual([]);
  });

  it('de outra pessoa é 100% dela', () => {
    expect(rateioDaCompra('outra', [{ terceiroId: 7, percentual: 0 }])).toEqual([
      { terceiroId: 7, percentual: 100 },
    ]);
  });

  it('dividida deixa o resto comigo', () => {
    expect(
      rateioDaCompra('dividida', [
        { terceiroId: 7, percentual: 30 },
        { terceiroId: 8, percentual: 30 },
      ]),
    ).toEqual([
      { terceiroId: 7, percentual: 30 },
      { terceiroId: 8, percentual: 30 },
      { terceiroId: null, percentual: 40 },
    ]);
  });

  it('dividida em 100% entre outras pessoas não me inclui', () => {
    expect(rateioDaCompra('dividida', [{ terceiroId: 7, percentual: 100 }])).toEqual([
      { terceiroId: 7, percentual: 100 },
    ]);
  });

  it.each([
    ['outra', [], 'Escolha uma pessoa'],
    ['dividida', [], 'Escolha pelo menos uma pessoa'],
    ['dividida', [{ terceiroId: 7, percentual: 0 }], 'Use um percentual de 1 a 100'],
    ['dividida', [{ terceiroId: 7, percentual: 12.5 }], 'Use um percentual de 1 a 100'],
    [
      'dividida',
      [
        { terceiroId: 7, percentual: 60 },
        { terceiroId: 8, percentual: 50 },
      ],
      'A soma passa de 100%',
    ],
  ] as const)('%s com %j recusa: %s', (modo, pessoas, mensagem) => {
    expect(() => rateioDaCompra(modo, pessoas)).toThrow(mensagem);
  });
});

describe('previaDaCompra', () => {
  it('mostra fatura, vencimento, valor e a parte de cada pessoa', () => {
    const previa = previaDaCompra(
      {
        valorTotal: 129_900,
        numParcelas: 6,
        dataCompra: '2026-10-19',
        rateios: [
          { terceiroId: null, percentual: 50 },
          { terceiroId: 7, percentual: 50 },
        ],
      },
      { diaFechamento: 28, diaVencimento: 5 },
    );

    expect(previa).toHaveLength(6);
    expect(previa[0]).toEqual({
      numero: 1,
      competencia: '2026-10',
      vencimento: '2026-11-05',
      valorCentavos: 21_650,
      porTerceiro: new Map([[7, 10_825]]),
    });
    expect(previa[5]?.competencia).toBe('2027-03');
  });
});

describe('prepararNovaCompra com assinatura', () => {
  it('leva a assinatura e o mês da cobrança para a compra', () => {
    const { compra } = prepararNovaCompra(
      { ...base, assinatura: { id: 4, mes: '2026-10' } },
      cartaoRoxo,
    );
    expect(compra).toMatchObject({ assinaturaId: 4, assinaturaMes: '2026-10' });
  });
});
