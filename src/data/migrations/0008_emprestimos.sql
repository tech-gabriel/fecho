CREATE TABLE emprestimos (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('tomado', 'concedido')),
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  terceiro_id INTEGER REFERENCES terceiros (id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  num_parcelas INTEGER CHECK (num_parcelas BETWEEN 1 AND 360),
  valor_parcela_centavos INTEGER CHECK (valor_parcela_centavos > 0),
  dia INTEGER CHECK (dia BETWEEN 1 AND 31),
  inicio TEXT CHECK (inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  prazo TEXT CHECK (prazo GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  deleted_at TEXT,
  CHECK (
    (tipo = 'tomado' AND num_parcelas IS NOT NULL AND valor_parcela_centavos IS NOT NULL
      AND dia IS NOT NULL AND inicio IS NOT NULL)
    OR (tipo = 'concedido' AND terceiro_id IS NOT NULL AND prazo IS NOT NULL)
  )
) STRICT;

CREATE TABLE emprestimo_pagamentos (
  emprestimo_id INTEGER NOT NULL REFERENCES emprestimos (id),
  numero INTEGER NOT NULL CHECK (numero >= 1),
  pago_em TEXT NOT NULL CHECK (pago_em GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  PRIMARY KEY (emprestimo_id, numero)
) STRICT;

CREATE TABLE abatimentos_novos (
  movimento_id INTEGER NOT NULL REFERENCES movimentos (id) ON DELETE CASCADE,
  compra_id INTEGER REFERENCES compras (id),
  numero INTEGER CHECK (numero BETWEEN 1 AND 24),
  emprestimo_id INTEGER REFERENCES emprestimos (id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  CHECK (
    (compra_id IS NOT NULL AND numero IS NOT NULL AND emprestimo_id IS NULL)
    OR (compra_id IS NULL AND numero IS NULL AND emprestimo_id IS NOT NULL)
  )
) STRICT;

INSERT INTO abatimentos_novos (movimento_id, compra_id, numero, valor_centavos)
  SELECT movimento_id, compra_id, numero, valor_centavos FROM abatimentos;

DROP TABLE abatimentos;
ALTER TABLE abatimentos_novos RENAME TO abatimentos;

CREATE UNIQUE INDEX abatimentos_da_compra ON abatimentos (movimento_id, compra_id, numero)
  WHERE compra_id IS NOT NULL;
CREATE UNIQUE INDEX abatimentos_do_emprestimo ON abatimentos (movimento_id, emprestimo_id)
  WHERE emprestimo_id IS NOT NULL;
