CREATE TABLE abatimentos_novos (
  movimento_id INTEGER NOT NULL REFERENCES movimentos (id) ON DELETE CASCADE,
  compra_id INTEGER REFERENCES compras (id),
  numero INTEGER CHECK (numero BETWEEN 1 AND 24),
  emprestimo_id INTEGER REFERENCES emprestimos (id),
  conta_fixa_id INTEGER REFERENCES contas_fixas (id),
  competencia TEXT CHECK (competencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  CHECK (
    (compra_id IS NOT NULL AND numero IS NOT NULL AND emprestimo_id IS NULL
      AND conta_fixa_id IS NULL AND competencia IS NULL)
    OR (emprestimo_id IS NOT NULL AND compra_id IS NULL AND numero IS NULL
      AND conta_fixa_id IS NULL AND competencia IS NULL)
    OR (conta_fixa_id IS NOT NULL AND competencia IS NOT NULL AND compra_id IS NULL
      AND numero IS NULL AND emprestimo_id IS NULL)
  )
) STRICT;

INSERT INTO abatimentos_novos (movimento_id, compra_id, numero, emprestimo_id, valor_centavos)
  SELECT movimento_id, compra_id, numero, emprestimo_id, valor_centavos FROM abatimentos;

DROP TABLE abatimentos;
ALTER TABLE abatimentos_novos RENAME TO abatimentos;

CREATE UNIQUE INDEX abatimentos_da_compra ON abatimentos (movimento_id, compra_id, numero)
  WHERE compra_id IS NOT NULL;
CREATE UNIQUE INDEX abatimentos_do_emprestimo ON abatimentos (movimento_id, emprestimo_id)
  WHERE emprestimo_id IS NOT NULL;
CREATE UNIQUE INDEX abatimentos_da_conta ON abatimentos (movimento_id, conta_fixa_id, competencia)
  WHERE conta_fixa_id IS NOT NULL;
