import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { NovaCompraPreparada } from '@/domain/compras';
import { migrations } from '../migrations';
import type { Banco } from '.';

// Faz o papel do plugin SQL e do comando Rust `salvar_compra` nos testes, com o SQL real.
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

  const salvarCompra = async ({ compra, rateios, parcelas }: NovaCompraPreparada) => {
    db.exec('BEGIN');
    try {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO compras (cartao_id, descricao, categoria_id, valor_total_centavos,
             num_parcelas, data_compra, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          compra.cartaoId,
          compra.descricao,
          compra.categoriaId,
          compra.valorTotalCentavos,
          compra.numParcelas,
          compra.dataCompra,
          compra.recorrente ? 1 : 0,
        );
      for (const r of rateios) {
        db.prepare('INSERT INTO rateios (compra_id, terceiro_id, percentual) VALUES (?, ?, ?)').run(
          lastInsertRowid,
          r.terceiroId,
          r.percentual,
        );
      }
      for (const p of parcelas) {
        db.prepare(
          'INSERT INTO parcelas (compra_id, numero, competencia, valor_centavos) VALUES (?, ?, ?, ?)',
        ).run(lastInsertRowid, p.numero, p.competencia, p.valorCentavos);
      }
      db.exec('COMMIT');
      return Number(lastInsertRowid);
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  };

  return { banco, salvarCompra, db };
}
