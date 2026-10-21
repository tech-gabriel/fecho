import { describe, expect, it } from 'vitest';
import { abasDaExportacao, CABECALHO, type ParcelaExportada } from './exportacao';
import { agruparCompras, detectarColunas, lerLinhas } from './importacao';

const cadastros = {
  cartoes: [
    { id: 1, nome: 'Roxo' },
    { id: 2, nome: 'Azul: [viagem]/2026 com um nome comprido demais' },
    { id: 3, nome: 'Roxo' },
  ],
  terceiros: [
    { id: 7, nome: 'Ana' },
    { id: 8, nome: 'Bruno' },
  ],
  categorias: [{ id: 4, nome: 'Mercado' }],
};

const parcela = (p: Partial<ParcelaExportada>): ParcelaExportada => ({
  numero: 1,
  numParcelas: 1,
  valorCentavos: 10_000,
  descricao: 'Compra',
  dataCompra: '2026-10-05',
  cartaoId: 1,
  categoriaId: null,
  recorrente: false,
  rateios: [],
  ...p,
});

describe('abasDaExportacao', () => {
  it('monta uma aba por cartão com o cabeçalho e as linhas ordenadas por data', () => {
    const abas = abasDaExportacao(
      [
        parcela({ descricao: 'Padaria', dataCompra: '2026-10-09', categoriaId: 4 }),
        parcela({ descricao: 'Livro', dataCompra: '2026-10-02', valorCentavos: 4_990 }),
      ],
      cadastros,
    );

    expect(abas).toEqual([
      {
        nome: 'Roxo',
        linhas: [
          CABECALHO,
          ['2026-10-02', 'Livro', 49.9, '', 'Eu', ''],
          ['2026-10-09', 'Padaria', 100, '', 'Eu', 'Mercado'],
        ],
      },
    ]);
  });

  it('põe a parcela no mês dela e escreve "3 de 10"', () => {
    const [aba] = abasDaExportacao(
      [parcela({ numero: 3, numParcelas: 10, dataCompra: '2026-08-31', valorCentavos: 2_500 })],
      cadastros,
    );

    expect(aba?.linhas[1]).toEqual(['2026-10-31', 'Compra', 25, '3 de 10', 'Eu', '']);
  });

  it('abre uma linha por dono e marca a compra recorrente minha', () => {
    const [aba] = abasDaExportacao(
      [
        parcela({
          descricao: 'Jantar',
          valorCentavos: 10_001,
          rateios: [
            { terceiroId: null, percentual: 50 },
            { terceiroId: 7, percentual: 50 },
          ],
        }),
        parcela({ descricao: 'Streaming', recorrente: true, dataCompra: '2026-10-06' }),
        parcela({
          descricao: 'Tênis',
          dataCompra: '2026-10-07',
          rateios: [{ terceiroId: 8, percentual: 100 }],
        }),
      ],
      cadastros,
    );

    expect(aba?.linhas.slice(1).map((l) => [l[1], l[2], l[4]])).toEqual([
      ['Jantar', 50.01, 'Eu'],
      ['Jantar', 50, 'Ana'],
      ['Streaming', 100, 'Recorrente'],
      ['Tênis', 100, 'Bruno'],
    ]);
  });

  it('limpa o nome da aba, corta em 31 letras e não repete nomes', () => {
    const abas = abasDaExportacao(
      [parcela({ cartaoId: 2 }), parcela({ cartaoId: 3 }), parcela({ cartaoId: 1 })],
      cadastros,
    );

    expect(abas.map((a) => a.nome)).toEqual([
      'Roxo',
      'Azul viagem2026 com um nome com',
      'Roxo (2)',
    ]);
    expect(abas.every((a) => a.nome.length <= 31)).toBe(true);
  });

  it('não cria aba para cartão sem compras e devolve vazio sem parcelas', () => {
    expect(abasDaExportacao([], cadastros)).toEqual([]);
  });

  it('volta para as mesmas compras quando a planilha é importada', () => {
    const parcelas = [
      parcela({ descricao: 'Geladeira', numero: 4, numParcelas: 10, dataCompra: '2026-07-15' }),
      parcela({ descricao: 'Livro', valorCentavos: 4_990 }),
    ];
    const [aba] = abasDaExportacao(parcelas, cadastros);
    const [cabecalho = [], ...linhas] = aba?.linhas ?? [];

    const lidas = lerLinhas({
      aba: 'Roxo',
      inicio: 0,
      linhas,
      destinos: detectarColunas(cabecalho).map((c) => c.destino),
      cartaoDaAba: 'Roxo',
    });

    expect(
      agruparCompras(lidas).map((c) => [c.descricao, c.dataCompra, c.valorTotal, c.numParcelas]),
    ).toEqual([
      ['Livro', '2026-10-05', 4_990, 1],
      ['Geladeira', '2026-07-15', 100_000, 10],
    ]);
    expect(lidas.every((l) => l.dono.tipo === 'meu')).toBe(true);
  });
});
