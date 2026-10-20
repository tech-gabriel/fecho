CREATE TABLE movimentos (
  id INTEGER PRIMARY KEY,
  terceiro_id INTEGER NOT NULL REFERENCES terceiros (id),
  emprestimo_id INTEGER,
  tipo TEXT NOT NULL CHECK (tipo IN ('deposito', 'cobranca')),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  competencia TEXT NOT NULL CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  deleted_at TEXT
) STRICT;

CREATE TABLE abatimentos (
  movimento_id INTEGER NOT NULL REFERENCES movimentos (id) ON DELETE CASCADE,
  compra_id INTEGER NOT NULL REFERENCES compras (id),
  numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 24),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  PRIMARY KEY (movimento_id, compra_id, numero)
) STRICT;

CREATE INDEX movimentos_terceiro ON movimentos (terceiro_id);
