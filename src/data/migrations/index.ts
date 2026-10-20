import cadastrosECompras from './0001_cadastros_e_compras.sql?raw';
import arquivarECategorias from './0002_arquivar_e_categorias.sql?raw';
import observacao from './0003_observacao.sql?raw';
import faturas from './0004_faturas.sql?raw';
import receitasEPreferencias from './0005_receitas_e_preferencias.sql?raw';
import movimentos from './0006_movimentos.sql?raw';
import assinaturas from './0007_assinaturas.sql?raw';

export const migrations = [
  { versao: 1, descricao: 'cadastros_e_compras', sql: cadastrosECompras },
  { versao: 2, descricao: 'arquivar_e_categorias', sql: arquivarECategorias },
  { versao: 3, descricao: 'observacao', sql: observacao },
  { versao: 4, descricao: 'faturas', sql: faturas },
  { versao: 5, descricao: 'receitas_e_preferencias', sql: receitasEPreferencias },
  { versao: 6, descricao: 'movimentos', sql: movimentos },
  { versao: 7, descricao: 'assinaturas', sql: assinaturas },
];
