CREATE TABLE economia_metas (
  id INTEGER PRIMARY KEY,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  inicio TEXT NOT NULL UNIQUE CHECK (inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]')
) STRICT;

CREATE TABLE economia_objetivos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  alvo_centavos INTEGER NOT NULL CHECK (alvo_centavos > 0),
  prazo TEXT CHECK (prazo GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  deleted_at TEXT
) STRICT;

CREATE TABLE economia_movimentos (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos <> 0),
  objetivo_id INTEGER REFERENCES economia_objetivos (id),
  deleted_at TEXT
) STRICT;

CREATE INDEX economia_movimentos_data ON economia_movimentos (data);
