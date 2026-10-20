import cadastrosECompras from './0001_cadastros_e_compras.sql?raw';
import arquivarECategorias from './0002_arquivar_e_categorias.sql?raw';
import observacao from './0003_observacao.sql?raw';

export const migrations = [
  { versao: 1, descricao: 'cadastros_e_compras', sql: cadastrosECompras },
  { versao: 2, descricao: 'arquivar_e_categorias', sql: arquivarECategorias },
  { versao: 3, descricao: 'observacao', sql: observacao },
];
