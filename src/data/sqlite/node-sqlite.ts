import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { NovaCompraPreparada } from '@/domain/compras';
import type { Cartao, Novo } from '../repositories';
import { migrations } from '../migrations';
import type { Banco, ComandosAtomicos, ParcelaMovida } from '.';

// Faz o papel do plugin SQL e dos comandos Rust nos testes, com o SQL real.
export function bancoDeTeste() {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) db.exec(m.sql);
  const params = (p: unknown[] = []) => p as SQLInputValue[];

  const banco: Banco = {
    select: async <T>(sql: string, p?: unknown[]) => db.prepare(sql).all(...params(p)) as T,
    execute: async (sql, p) => {
      const r = db.prepare(sql).run(...params(p));
      return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
    },
  };

  const transacao = <T>(trabalho: () => T): T => {
    db.exec('BEGIN');
    try {
      const resultado = trabalho();
      db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  };

  const inserirFilhos = (compraId: number | bigint, { rateios, parcelas }: NovaCompraPreparada) => {
    for (const r of rateios) {
      db.prepare('INSERT INTO rateios (compra_id, terceiro_id, percentual) VALUES (?, ?, ?)').run(
        compraId,
        r.terceiroId,
        r.percentual,
      );
    }
    for (const p of parcelas) {
      db.prepare(
        'INSERT INTO parcelas (compra_id, numero, competencia, valor_centavos) VALUES (?, ?, ?, ?)',
      ).run(compraId, p.numero, p.competencia, p.valorCentavos);
    }
  };

  const valoresDaCompra = ({ compra }: NovaCompraPreparada) => [
    compra.cartaoId,
    compra.descricao,
    compra.categoriaId,
    compra.valorTotalCentavos,
    compra.numParcelas,
    compra.dataCompra,
    compra.recorrente ? 1 : 0,
    compra.observacao,
  ];

  const salvarCompra = async (preparada: NovaCompraPreparada) =>
    transacao(() => {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO compras (cartao_id, descricao, categoria_id, valor_total_centavos,
             num_parcelas, data_compra, recorrente, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...valoresDaCompra(preparada));
      inserirFilhos(lastInsertRowid, preparada);
      return Number(lastInsertRowid);
    });

  const substituirCompra = async (id: number, preparada: NovaCompraPreparada) => {
    transacao(() => {
      const { changes } = db
        .prepare(
          `UPDATE compras SET cartao_id = ?, descricao = ?, categoria_id = ?, valor_total_centavos = ?,
             num_parcelas = ?, data_compra = ?, recorrente = ?, observacao = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .run(...valoresDaCompra(preparada), id);
      if (changes === 0) throw new Error(`Compra ${id} não encontrada`);
      db.prepare('DELETE FROM rateios WHERE compra_id = ?').run(id);
      db.prepare('DELETE FROM parcelas WHERE compra_id = ?').run(id);
      inserirFilhos(id, preparada);
    });
  };

  const atualizarCartao = async (id: number, cartao: Novo<Cartao>, parcelas: ParcelaMovida[]) => {
    db.exec('BEGIN');
    try {
      db.prepare(
        `UPDATE cartoes SET nome = ?, dia_fechamento = ?, dia_vencimento = ?, limite_centavos = ?,
           cor = ?, ativo = ? WHERE id = ?`,
      ).run(
        cartao.nome,
        cartao.diaFechamento,
        cartao.diaVencimento,
        cartao.limiteCentavos,
        cartao.cor,
        cartao.ativo ? 1 : 0,
        id,
      );
      for (const p of parcelas) {
        const { changes } = db
          .prepare(
            `UPDATE parcelas SET competencia = ? WHERE compra_id = ? AND numero = ?
               AND compra_id IN (SELECT id FROM compras WHERE cartao_id = ?)`,
          )
          .run(p.competencia, p.compraId, p.numero, id);
        if (changes === 0)
          throw new Error(`Parcela ${p.numero} da compra ${p.compraId} não existe`);
      }
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  };

  const comandos: ComandosAtomicos = { salvarCompra, substituirCompra, atualizarCartao };
  return { banco, comandos, db };
}
