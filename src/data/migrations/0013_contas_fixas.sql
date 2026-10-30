CREATE TABLE contas_fixas (
  id INTEGER PRIMARY KEY,
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  categoria_id INTEGER REFERENCES categorias (id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  dia INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
  inicio TEXT NOT NULL CHECK (inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  rateios TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT
) STRICT;

CREATE TABLE contas_fixas_pagamentos (
  conta_id INTEGER NOT NULL REFERENCES contas_fixas (id),
  competencia TEXT NOT NULL CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  pago_em TEXT NOT NULL CHECK (pago_em GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  PRIMARY KEY (conta_id, competencia)
) STRICT;
