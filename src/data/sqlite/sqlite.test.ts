import { describe, expect, it } from 'vitest';
import { backupIndisponivel } from '../backup';
import { contratoDosRepositorios } from '../contrato.suite';
import { criarRepositoriosSqlite } from '.';
import { bancoDeTeste } from './node-sqlite';

contratoDosRepositorios('sqlite', async () => {
  const { banco, comandos } = bancoDeTeste();
  return criarRepositoriosSqlite(banco, comandos, backupIndisponivel);
});

describe('sqlite', () => {
  it('grava exclusão lógica em vez de apagar a linha', async () => {
    const { banco, comandos, db } = bancoDeTeste();
    const repos = criarRepositoriosSqlite(banco, comandos, backupIndisponivel);
    const id = await repos.categorias.criar({
      nome: 'Mercado',
      icone: 'shopping-cart',
      ativo: true,
    });

    await repos.categorias.excluir(id);

    const linha = db.prepare('SELECT deleted_at FROM categorias WHERE id = ?').get(id);
    expect(linha?.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('atualizar sem campos não faz nada', async () => {
    const { banco, comandos } = bancoDeTeste();
    const repos = criarRepositoriosSqlite(banco, comandos, backupIndisponivel);
    await expect(repos.categorias.atualizar(9999, {})).resolves.toBeUndefined();
  });

  it('grava a observação da compra', async () => {
    const { banco, comandos, db } = bancoDeTeste();
    const repos = criarRepositoriosSqlite(banco, comandos, backupIndisponivel);
    const cartao = await repos.cartoes.criar({
      nome: 'Roxo',
      diaFechamento: 28,
      diaVencimento: 5,
      limiteCentavos: 0,
      cor: '#8B5CF6',
      ativo: true,
    });

    const id = await repos.compras.salvar({
      cartaoId: cartao,
      descricao: 'Livro',
      categoriaId: null,
      valorTotal: 5_000,
      numParcelas: 1,
      dataCompra: '2026-10-19',
      recorrente: true,
      rateios: [],
      observacao: ' presente da Ana ',
    });

    expect(db.prepare('SELECT observacao, recorrente FROM compras WHERE id = ?').get(id)).toEqual({
      observacao: 'presente da Ana',
      recorrente: 1,
    });
  });

  it('a transação desfaz tudo quando uma parcela é recusada pelo banco', async () => {
    const { banco, comandos, db } = bancoDeTeste();
    const repos = criarRepositoriosSqlite(banco, comandos, backupIndisponivel);
    const cartao = await repos.cartoes.criar({
      nome: 'Roxo',
      diaFechamento: 28,
      diaVencimento: 5,
      limiteCentavos: 0,
      cor: '#8B5CF6',
      ativo: true,
    });

    await expect(
      comandos.salvarCompra({
        compra: {
          cartaoId: cartao,
          descricao: 'X',
          categoriaId: null,
          valorTotalCentavos: 100,
          numParcelas: 1,
          dataCompra: '2026-10-19',
          recorrente: false,
          observacao: null,
        },
        rateios: [],
        parcelas: [{ numero: 99, competencia: '2026-10', valorCentavos: 100 }],
      }),
    ).rejects.toThrow();

    expect(db.prepare('SELECT count(*) AS n FROM compras').get()?.n).toBe(0);
  });
});
