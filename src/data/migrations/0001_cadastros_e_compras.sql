CREATE TABLE cartoes (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite_centavos INTEGER NOT NULL DEFAULT 0 CHECK (limite_centavos >= 0),
  cor TEXT NOT NULL,
  deleted_at TEXT
) STRICT;

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  icone TEXT NOT NULL,
  deleted_at TEXT
) STRICT;

CREATE TABLE terceiros (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  cor TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  deleted_at TEXT
) STRICT;

CREATE TABLE compras (
  id INTEGER PRIMARY KEY,
  cartao_id INTEGER NOT NULL REFERENCES cartoes (id),
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  categoria_id INTEGER REFERENCES categorias (id),
  valor_total_centavos INTEGER NOT NULL CHECK (valor_total_centavos > 0),
  num_parcelas INTEGER NOT NULL CHECK (num_parcelas BETWEEN 1 AND 24),
  data_compra TEXT NOT NULL CHECK (data_compra GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  recorrente INTEGER NOT NULL DEFAULT 0 CHECK (recorrente IN (0, 1)),
  deleted_at TEXT
) STRICT;

CREATE TABLE rateios (
  compra_id INTEGER NOT NULL REFERENCES compras (id) ON DELETE CASCADE,
  terceiro_id INTEGER REFERENCES terceiros (id),
  percentual INTEGER NOT NULL CHECK (percentual BETWEEN 1 AND 100),
  UNIQUE (compra_id, terceiro_id)
) STRICT;

CREATE TABLE parcelas (
  id INTEGER PRIMARY KEY,
  compra_id INTEGER NOT NULL REFERENCES compras (id) ON DELETE CASCADE,
  numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 24),
  competencia TEXT NOT NULL CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  valor_centavos INTEGER NOT NULL,
  UNIQUE (compra_id, numero)
) STRICT;

CREATE INDEX parcelas_competencia ON parcelas (competencia);
CREATE INDEX compras_cartao ON compras (cartao_id);
CREATE INDEX rateios_terceiro ON rateios (terceiro_id);
