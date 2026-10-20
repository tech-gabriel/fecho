import { type NovaCompraPreparada, prepararNovaCompra } from '@/domain/compras';
import { assertCentavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';
import {
  type Cadastro,
  type Cartao,
  type Categoria,
  type ComprasRepository,
  type Novo,
  type ParcelaDoMes,
  RegistroNaoEncontrado,
  type Repositorios,
  type Terceiro,
} from '../repositories';

export interface Banco {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rowsAffected: number; lastInsertId?: number }>;
}

export type SalvarCompraAtomica = (compra: NovaCompraPreparada) => Promise<number>;

type Linha = Record<string, unknown>;

interface Mapeamento<T> {
  entidade: string;
  tabela: string;
  colunas: Record<keyof Novo<T>, string>;
  ler(linha: Linha): T;
  gravar?: Partial<Record<keyof Novo<T>, (valor: unknown) => unknown>>;
}

function cadastroSqlite<T extends { id: number }>(banco: Banco, m: Mapeamento<T>): Cadastro<T> {
  const campos = Object.keys(m.colunas) as (keyof Novo<T>)[];
  const valor = (campo: keyof Novo<T>, v: unknown) => {
    const converter = m.gravar?.[campo];
    return converter ? converter(v) : v;
  };

  const exigirLinha = async (id: number, sql: string, params: unknown[]) => {
    const { rowsAffected } = await banco.execute(sql, params);
    if (rowsAffected === 0) throw new RegistroNaoEncontrado(m.entidade, id);
  };

  return {
    listar: async () => {
      const linhas = await banco.select<Linha[]>(
        `SELECT id, ${campos.map((c) => m.colunas[c]).join(', ')} FROM ${m.tabela}
         WHERE deleted_at IS NULL ORDER BY id`,
      );
      return linhas.map((l) => m.ler(l));
    },
    criar: async (novo) => {
      const { lastInsertId } = await banco.execute(
        `INSERT INTO ${m.tabela} (${campos.map((c) => m.colunas[c]).join(', ')})
         VALUES (${campos.map(() => '?').join(', ')})`,
        campos.map((c) => valor(c, novo[c])),
      );
      return Number(lastInsertId);
    },
    atualizar: async (id, dados) => {
      const alterados = campos.filter((c) => dados[c] !== undefined);
      if (alterados.length === 0) return;
      await exigirLinha(
        id,
        `UPDATE ${m.tabela} SET ${alterados.map((c) => `${m.colunas[c]} = ?`).join(', ')} WHERE id = ?`,
        [...alterados.map((c) => valor(c, dados[c])), id],
      );
    },
    excluir: (id) =>
      exigirLinha(id, `UPDATE ${m.tabela} SET deleted_at = ? WHERE id = ?`, [
        new Date().toISOString(),
        id,
      ]),
    restaurar: (id) =>
      exigirLinha(id, `UPDATE ${m.tabela} SET deleted_at = NULL WHERE id = ?`, [id]),
  };
}

const numero = (v: unknown) => Number(v);
const booleano = (v: unknown) => (v ? 1 : 0);

function comprasSqlite(banco: Banco, salvarAtomica: SalvarCompraAtomica): ComprasRepository {
  const exigirLinha = async (id: number, sql: string, params: unknown[]) => {
    const { rowsAffected } = await banco.execute(sql, params);
    if (rowsAffected === 0) throw new RegistroNaoEncontrado('Compra', id);
  };

  return {
    salvar: async (dados) => {
      const [cartao] = await banco.select<Linha[]>(
        'SELECT dia_fechamento FROM cartoes WHERE id = ? AND deleted_at IS NULL',
        [dados.cartaoId],
      );
      if (!cartao) throw new RegistroNaoEncontrado('Cartão', dados.cartaoId);
      return salvarAtomica(
        prepararNovaCompra(dados, { diaFechamento: numero(cartao.dia_fechamento) }),
      );
    },
    parcelasDaCompetencia: async (competencia) => {
      const linhas = await banco.select<Linha[]>(
        `SELECT p.id AS parcela_id, p.compra_id, p.numero, p.competencia, p.valor_centavos,
                c.num_parcelas, c.descricao, c.data_compra, c.cartao_id, c.categoria_id, c.recorrente
         FROM parcelas p JOIN compras c ON c.id = p.compra_id
         WHERE p.competencia = ? AND c.deleted_at IS NULL
         ORDER BY c.data_compra, p.id`,
        [competencia],
      );
      const ids = [...new Set(linhas.map((l) => numero(l.compra_id)))];
      const rateios =
        ids.length === 0
          ? []
          : await banco.select<Linha[]>(
              `SELECT compra_id, terceiro_id, percentual FROM rateios
               WHERE compra_id IN (${ids.map(() => '?').join(', ')}) ORDER BY rowid`,
              ids,
            );

      return linhas.map((l): ParcelaDoMes => ({
        parcelaId: numero(l.parcela_id),
        compraId: numero(l.compra_id),
        numero: numero(l.numero),
        numParcelas: numero(l.num_parcelas),
        competencia: String(l.competencia),
        valorCentavos: assertCentavos(numero(l.valor_centavos)),
        descricao: String(l.descricao),
        dataCompra: String(l.data_compra),
        cartaoId: numero(l.cartao_id),
        categoriaId: l.categoria_id === null ? null : numero(l.categoria_id),
        recorrente: Boolean(l.recorrente),
        rateios: rateios
          .filter((r) => numero(r.compra_id) === numero(l.compra_id))
          .map((r): Rateio => ({
            terceiroId: r.terceiro_id === null ? null : numero(r.terceiro_id),
            percentual: numero(r.percentual),
          })),
      }));
    },
    excluir: (id) =>
      exigirLinha(id, 'UPDATE compras SET deleted_at = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ]),
    restaurar: (id) => exigirLinha(id, 'UPDATE compras SET deleted_at = NULL WHERE id = ?', [id]),
  };
}

export function criarRepositoriosSqlite(
  banco: Banco,
  salvarCompraAtomica: SalvarCompraAtomica,
): Repositorios {
  return {
    cartoes: cadastroSqlite<Cartao>(banco, {
      entidade: 'Cartão',
      tabela: 'cartoes',
      colunas: {
        nome: 'nome',
        diaFechamento: 'dia_fechamento',
        diaVencimento: 'dia_vencimento',
        limiteCentavos: 'limite_centavos',
        cor: 'cor',
      },
      ler: (l) => ({
        id: numero(l.id),
        nome: String(l.nome),
        diaFechamento: numero(l.dia_fechamento),
        diaVencimento: numero(l.dia_vencimento),
        limiteCentavos: assertCentavos(numero(l.limite_centavos)),
        cor: String(l.cor),
      }),
    }),
    categorias: cadastroSqlite<Categoria>(banco, {
      entidade: 'Categoria',
      tabela: 'categorias',
      colunas: { nome: 'nome', icone: 'icone' },
      ler: (l) => ({ id: numero(l.id), nome: String(l.nome), icone: String(l.icone) }),
    }),
    terceiros: cadastroSqlite<Terceiro>(banco, {
      entidade: 'Terceiro',
      tabela: 'terceiros',
      colunas: { nome: 'nome', cor: 'cor', ativo: 'ativo' },
      gravar: { ativo: booleano },
      ler: (l) => ({
        id: numero(l.id),
        nome: String(l.nome),
        cor: String(l.cor),
        ativo: Boolean(l.ativo),
      }),
    }),
    compras: comprasSqlite(banco, salvarCompraAtomica),
  };
}
