import { describe, expect, it } from 'vitest';
import {
  agruparCompras,
  detectarCabecalho,
  detectarColunas,
  lerData,
  lerDono,
  lerLinhas,
  lerParcela,
  lerValor,
  marcarDuplicadas,
  problemasDaImportacao,
  type LinhaLida,
} from './importacao';

describe('lerData', () => {
  it.each([
    ['12/10/2026', '2026-10-12'],
    ['5/1/26', '2026-01-05'],
    ['2026-10-12', '2026-10-12'],
    ['2026-10-12T00:00:00', '2026-10-12'],
    [46307, '2026-10-12'],
    [' 01/02/2026 ', '2026-02-01'],
  ])('lê %j como %s', (celula, data) => {
    expect(lerData(celula)).toBe(data);
  });

  it.each([['31/02/2026'], ['ontem'], [''], [null], [3], [true]])('recusa %j', (celula) => {
    expect(lerData(celula)).toBeNull();
  });
});

describe('lerValor', () => {
  it.each([
    [108.25, 10_825],
    ['1.234,56', 123_456],
    ['R$ 10', 1_000],
    ['12.34', 1_234],
    ['-5,00', -500],
    ['(5,00)', -500],
    ['R$ -1.000,00', -100_000],
  ])('lê %j como %d centavos', (celula, centavos) => {
    expect(lerValor(celula)).toBe(centavos);
  });

  it.each([['abc'], [''], [null], ['1,234']])('recusa %j', (celula) => {
    expect(lerValor(celula)).toBeNull();
  });
});

describe('lerParcela', () => {
  it.each([
    ['3/6', { numero: 3, total: 6 }],
    ['3 de 6', { numero: 3, total: 6 }],
    ['03/10', { numero: 3, total: 10 }],
    ['1/1', null],
    ['', null],
    ['—', null],
    ['-', null],
    ['à vista', null],
    [null, null],
  ])('lê %j', (celula, parcela) => {
    expect(lerParcela(celula)).toEqual(parcela);
  });

  it.each([['7/6'], ['0/3'], ['3/30'], ['seis']])('marca %j como inválida', (celula) => {
    expect(lerParcela(celula)).toBe('invalida');
  });
});

describe('lerDono', () => {
  it.each([
    ['', { tipo: 'meu' }],
    ['Eu', { tipo: 'meu' }],
    ['minha', { tipo: 'meu' }],
    ['Recorrente', { tipo: 'recorrente' }],
    ['Ana', { tipo: 'pessoa', nome: 'Ana' }],
    ['Ana e eu', { tipo: 'varias', nomes: ['Ana'], incluiMeu: true }],
    ['Ana/Bruno', { tipo: 'varias', nomes: ['Ana', 'Bruno'], incluiMeu: false }],
    ['Ana, Bruno + meu', { tipo: 'varias', nomes: ['Ana', 'Bruno'], incluiMeu: true }],
  ] as const)('lê %j', (celula, dono) => {
    expect(lerDono(celula)).toEqual(dono);
  });
});

describe('detecção de cabeçalho e colunas', () => {
  it('acha a linha do cabeçalho mesmo com título acima', () => {
    expect(
      detectarCabecalho([
        ['Controle de Finanças', null],
        [],
        ['Data', 'Descrição', 'Valor'],
        ['12/10/2026', 'Mercado', '10,00'],
      ]),
    ).toBe(2);
    expect(detectarCabecalho([['x', 'y']])).toBe(0);
  });

  it('reconhece sinônimos sem acento e sem caixa', () => {
    expect(
      detectarColunas([
        'DATA',
        'Histórico',
        'Preço',
        'Cartão',
        'Parc.',
        'Responsável',
        'Categoria',
        'Obs',
      ]),
    ).toEqual([
      { destino: 'data', detectada: true },
      { destino: 'descricao', detectada: true },
      { destino: 'valor', detectada: true },
      { destino: 'cartao', detectada: true },
      { destino: 'parcela', detectada: true },
      { destino: 'dono', detectada: true },
      { destino: 'categoria', detectada: true },
      { destino: 'ignorar', detectada: false },
    ]);
  });

  it('não repete um destino', () => {
    expect(detectarColunas(['Valor', 'Valor total']).map((c) => c.destino)).toEqual([
      'valor',
      'ignorar',
    ]);
  });
});

describe('lerLinhas', () => {
  it('converte cada linha pelo mapeamento e usa o cartão da aba quando falta a coluna', () => {
    const [linha] = lerLinhas({
      aba: 'Nubank',
      inicio: 2,
      linhas: [['12/10/2026', ' Mercado ', '48,73', '2/3', 'Ana', 'Casa']],
      destinos: ['data', 'descricao', 'valor', 'parcela', 'dono', 'categoria'],
      cartaoDaAba: 'Nubank',
    });

    expect(linha).toEqual({
      id: 'Nubank:3',
      aba: 'Nubank',
      linha: 3,
      data: '2026-10-12',
      descricao: 'Mercado',
      valor: 4_873,
      cartao: 'Nubank',
      parcela: { numero: 2, total: 3 },
      dono: { tipo: 'pessoa', nome: 'Ana' },
      categoria: 'Casa',
    });
  });

  it('pula linhas totalmente vazias', () => {
    expect(
      lerLinhas({
        aba: 'A',
        inicio: 0,
        linhas: [[], [null, ''], ['1/1/2026', 'X', '1']],
        destinos: ['data', 'descricao', 'valor'],
        cartaoDaAba: 'A',
      }),
    ).toHaveLength(1);
  });
});

const linha = (extra: Partial<LinhaLida>): LinhaLida => ({
  id: 'A:1',
  aba: 'A',
  linha: 1,
  data: '2026-10-12',
  descricao: 'Mercado',
  valor: 1_000,
  cartao: 'Roxo',
  parcela: null,
  dono: { tipo: 'meu' },
  categoria: null,
  ...extra,
});

describe('agruparCompras', () => {
  it('compra à vista vira uma compra', () => {
    expect(agruparCompras([linha({})])).toEqual([
      {
        chave: 'A:1',
        linhas: ['A:1'],
        cartao: 'Roxo',
        descricao: 'Mercado',
        dataCompra: '2026-10-12',
        valorTotal: 1_000,
        numParcelas: 1,
        dono: { tipo: 'meu' },
        categoria: null,
      },
    ]);
  });

  it('parcelas repetidas mês a mês com a mesma data viram uma compra', () => {
    const [compra] = agruparCompras([
      linha({
        id: 'A:1',
        descricao: 'Tênis',
        valor: 10_825,
        parcela: { numero: 1, total: 6 },
        data: '2026-10-02',
      }),
      linha({
        id: 'B:1',
        descricao: 'tênis ',
        valor: 10_825,
        parcela: { numero: 2, total: 6 },
        data: '2026-10-02',
      }),
    ]);

    expect(compra).toMatchObject({
      linhas: ['A:1', 'B:1'],
      dataCompra: '2026-10-02',
      valorTotal: 64_950,
      numParcelas: 6,
    });
  });

  it('parcela solta com data do mês recua até a data da compra', () => {
    const [compra] = agruparCompras([
      linha({
        descricao: 'Notebook',
        valor: 48_000,
        parcela: { numero: 4, total: 10 },
        data: '2026-10-15',
      }),
    ]);

    expect(compra).toMatchObject({
      dataCompra: '2026-07-15',
      valorTotal: 480_000,
      numParcelas: 10,
    });
  });

  it('número de parcela repetido separa em compras diferentes', () => {
    const compras = agruparCompras([
      linha({ id: 'A:1', parcela: { numero: 1, total: 2 }, data: '2026-10-01' }),
      linha({ id: 'A:2', parcela: { numero: 1, total: 2 }, data: '2026-10-20' }),
    ]);

    expect(compras).toHaveLength(2);
  });

  it('recorrente vira atributo e não pessoa', () => {
    const [compra] = agruparCompras([linha({ dono: { tipo: 'recorrente' } })]);
    expect(compra?.dono).toEqual({ tipo: 'recorrente' });
  });
});

describe('problemasDaImportacao', () => {
  it('lista valor, data, parcela inválidos, divisão, cartão novo e valores diferentes no grupo', () => {
    const linhas = [
      linha({ id: 'A:1', valor: null }),
      linha({ id: 'A:2', data: null }),
      linha({ id: 'A:3', parcela: 'invalida' }),
      linha({ id: 'A:4', valor: -500 }),
      linha({ id: 'A:5', dono: { tipo: 'varias', nomes: ['Ana'], incluiMeu: true } }),
      linha({ id: 'A:6', cartao: 'Nubank' }),
      linha({ id: 'A:7', descricao: 'TV', valor: 10_000, parcela: { numero: 1, total: 3 } }),
      linha({ id: 'A:8', descricao: 'TV', valor: 10_001, parcela: { numero: 2, total: 3 } }),
    ];

    const problemas = problemasDaImportacao(linhas, agruparCompras(linhas.slice(4)), ['Roxo']);

    expect(problemas.map((p) => [p.tipo, p.chave])).toEqual([
      ['valor', 'A:1'],
      ['data', 'A:2'],
      ['parcela', 'A:3'],
      ['negativo', 'A:4'],
      ['divisao', 'A:5'],
      ['valoresDiferentes', 'A:7'],
      ['cartaoNovo', 'Nubank'],
    ]);
  });
});

describe('marcarDuplicadas', () => {
  it('acha compra igual já gravada (data, cartão, descrição e valor)', () => {
    const compras = agruparCompras([
      linha({ id: 'A:1' }),
      linha({ id: 'A:2', descricao: 'Outra' }),
    ]);

    expect(
      marcarDuplicadas(compras, [
        { dataCompra: '2026-10-12', cartao: 'roxo', descricao: 'MERCADO', valorTotal: 1_000 },
      ]),
    ).toEqual(new Set(['A:1']));
  });
});
