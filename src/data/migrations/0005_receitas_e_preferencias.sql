CREATE TABLE receitas (
  id INTEGER PRIMARY KEY,
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  competencia TEXT NOT NULL CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  competencia_fim TEXT CHECK (competencia_fim GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  recorrente INTEGER NOT NULL DEFAULT 0 CHECK (recorrente IN (0, 1)),
  deleted_at TEXT
) STRICT;

CREATE TABLE preferencias (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
) STRICT;
