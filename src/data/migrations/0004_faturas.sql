CREATE TABLE faturas (
  cartao_id INTEGER NOT NULL REFERENCES cartoes (id),
  competencia TEXT NOT NULL CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  pago_em TEXT NOT NULL CHECK (pago_em GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  valor_pago_centavos INTEGER NOT NULL CHECK (valor_pago_centavos >= 0),
  PRIMARY KEY (cartao_id, competencia)
) STRICT;
