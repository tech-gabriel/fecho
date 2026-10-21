CREATE TABLE meses_fechados (
  competencia TEXT PRIMARY KEY CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  fechado_em TEXT NOT NULL CHECK (fechado_em GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
) STRICT;

CREATE TABLE conferencias (
  cartao_id INTEGER NOT NULL REFERENCES cartoes (id),
  competencia TEXT NOT NULL CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  extrato TEXT,
  conferida_em TEXT NOT NULL CHECK (conferida_em GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  PRIMARY KEY (cartao_id, competencia)
) STRICT;
