ALTER TABLE cartoes ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1));
ALTER TABLE categorias ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1));

INSERT INTO categorias (nome, icone) VALUES
  ('Mercado', 'shopping-cart'),
  ('Restaurante', 'utensils'),
  ('Transporte', 'car'),
  ('Casa', 'house'),
  ('Saúde', 'heart-pulse'),
  ('Lazer', 'party-popper'),
  ('Compras', 'shopping-bag'),
  ('Assinaturas', 'repeat'),
  ('Educação', 'graduation-cap'),
  ('Outros', 'tag');
