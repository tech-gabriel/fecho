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
      'abatimentos',
      'assinaturas',
      'cartoes',
      'categorias',
      'compras',
      'economia_metas',
      'economia_movimentos',
      'economia_objetivos',
      'emprestimo_pagamentos',
      'emprestimos',
      'faturas',
      'movimentos',
      'parcelas',
      'preferencias',
      'rateios',
      'receitas',
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

  it('mantêm os abatimentos ao recriar a tabela para aceitar empréstimos', () => {
    const db = new DatabaseSync(':memory:');
    const ate = (versao: number) => {
      for (const m of migrations.filter((m) => m.versao <= versao)) db.exec(m.sql);
    };
    ate(7);
    db.exec(`
      INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Roxo', 28, 5, '#000');
      INSERT INTO terceiros (nome, cor) VALUES ('Ana', '#000');
      INSERT INTO compras (cartao_id, descricao, valor_total_centavos, num_parcelas, data_compra)
        VALUES (1, 'Tênis', 100, 1, '2026-10-02');
      INSERT INTO movimentos (terceiro_id, tipo, valor_centavos, data, competencia)
        VALUES (1, 'deposito', 100, '2026-10-20', '2026-10');
      INSERT INTO abatimentos (movimento_id, compra_id, numero, valor_centavos) VALUES (1, 1, 1, 100);
    `);
    for (const m of migrations.filter((m) => m.versao > 7)) db.exec(m.sql);

    expect(
      db.prepare('SELECT compra_id, numero, emprestimo_id, valor_centavos FROM abatimentos').all(),
    ).toEqual([{ compra_id: 1, numero: 1, emprestimo_id: null, valor_centavos: 100 }]);
    db.exec(`INSERT INTO emprestimos (tipo, descricao, terceiro_id, valor_centavos, data, prazo)
      VALUES ('concedido', 'Empréstimo', 1, 800, '2026-08-15', '2026-10-15')`);
    db.exec(
      'INSERT INTO abatimentos (movimento_id, emprestimo_id, valor_centavos) VALUES (1, 1, 50)',
    );
    expect(() => {
      db.exec(
        'INSERT INTO abatimentos (movimento_id, compra_id, numero, emprestimo_id, valor_centavos) VALUES (1, 1, 1, 1, 50)',
      );
    }).toThrow();
    expect(() => {
      db.exec(
        `INSERT INTO emprestimos (tipo, descricao, valor_centavos, data) VALUES ('tomado', 'X', 100, '2026-10-01')`,
      );
    }).toThrow();
  });
});
