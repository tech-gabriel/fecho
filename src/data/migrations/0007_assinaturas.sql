CREATE TABLE assinaturas (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  cartao_id INTEGER NOT NULL REFERENCES cartoes (id),
  categoria_id INTEGER REFERENCES categorias (id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  dia INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
  rateios TEXT NOT NULL DEFAULT '[]',
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  inicio TEXT NOT NULL CHECK (inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  deleted_at TEXT
) STRICT;

ALTER TABLE compras ADD COLUMN assinatura_id INTEGER REFERENCES assinaturas (id);
ALTER TABLE compras ADD COLUMN assinatura_mes TEXT;

CREATE UNIQUE INDEX compras_assinatura_mes ON compras (assinatura_id, assinatura_mes)
  WHERE assinatura_id IS NOT NULL;
