import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrations } from '.';

function bancoMigrado() {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) db.exec(m.sql);
  return db;
}

describe('migrations', () => {
  it('são numeradas em sequência a partir de 1', () => {
    expect(migrations.map((m) => m.versao)).toEqual(migrations.map((_, i) => i + 1));
  });

  it('criam as tabelas de cadastros e compras', () => {
    const tabelas = bancoMigrado()
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((t) => t.name);
    expect(tabelas).toEqual([
      'cartoes',
      'categorias',
      'compras',
      'parcelas',
      'rateios',
      'terceiros',
    ]);
  });

  it('criam as categorias padrão, ativas', () => {
    const categorias = bancoMigrado()
      .prepare('SELECT nome, ativo FROM categorias ORDER BY id')
      .all();
    expect(categorias.map((c) => c.nome)).toEqual([
      'Mercado',
      'Restaurante',
      'Transporte',
      'Casa',
      'Saúde',
      'Lazer',
      'Compras',
      'Assinaturas',
      'Educação',
      'Outros',
    ]);
    expect(categorias.every((c) => c.ativo === 1)).toBe(true);
  });

  it('barram dados que o domínio nunca deveria gerar', () => {
    const db = bancoMigrado();
    expect(() => {
      db.exec(
        "INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, cor) VALUES ('X', 32, 5, '#000')",
      );
    }).toThrow();
    expect(() => {
      db.exec(
        "INSERT INTO compras (cartao_id, descricao, valor_total_centavos, num_parcelas, data_compra) VALUES (999, 'X', 100, 1, '2026-10-19')",
      );
    }).toThrow();
  });
});
