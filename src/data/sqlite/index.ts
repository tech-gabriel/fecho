import { type NovaCompraPreparada, prepararNovaCompra } from '@/domain/compras';
import type { CompraParaRecalculo } from '@/domain/faturas';
import { assertCentavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';
import {
  type Cadastro,
  type Cartao,
  type CartoesRepository,
  type FaturasRepository,
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

export interface ParcelaMovida {
  compraId: number;
  numero: number;
  competencia: string;
}

export interface ComandosAtomicos {
  salvarCompra(compra: NovaCompraPreparada): Promise<number>;
  substituirCompra(id: number, compra: NovaCompraPreparada): Promise<void>;
  atualizarCartao(id: number, cartao: Novo<Cartao>, parcelas: ParcelaMovida[]): Promise<void>;
}

type Linha = Record<string, unknown>;

interface Mapeamento<T> {
  entidade: string;
  tabela: string;
  colunas: Record<keyof Novo<T>, string>;
  usoSql: string;
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
    possuiCompras: async (id) => {
      const linhas = await banco.select<Linha[]>(`SELECT EXISTS (${m.usoSql}) AS usado`, [id]);
      return Boolean(linhas[0]?.usado);
    },
  };
}

const numero = (v: unknown) => Number(v);
const booleano = (v: unknown) => (v ? 1 : 0);

function cartoesSqlite(banco: Banco, comandos: ComandosAtomicos): CartoesRepository {
  const cadastro = cadastroSqlite<Cartao>(banco, {
    entidade: 'Cartão',
    tabela: 'cartoes',
    colunas: {
      nome: 'nome',
      diaFechamento: 'dia_fechamento',
      diaVencimento: 'dia_vencimento',
      limiteCentavos: 'limite_centavos',
      cor: 'cor',
      ativo: 'ativo',
    },
    usoSql: 'SELECT 1 FROM compras WHERE cartao_id = ?',
    gravar: { ativo: booleano },
    ler: (l) => ({
      id: numero(l.id),
      nome: String(l.nome),
      diaFechamento: numero(l.dia_fechamento),
      diaVencimento: numero(l.dia_vencimento),
      limiteCentavos: assertCentavos(numero(l.limite_centavos)),
      cor: String(l.cor),
      ativo: Boolean(l.ativo),
    }),
  });

  return {
    ...cadastro,
    comprasParaRecalculo: async (id) => {
      const linhas = await banco.select<Linha[]>(
        `SELECT c.id, c.descricao, c.data_compra, p.numero, p.competencia
         FROM compras c JOIN parcelas p ON p.compra_id = c.id
         WHERE c.cartao_id = ? AND c.deleted_at IS NULL
         ORDER BY c.id, p.numero`,
        [id],
      );
      const compras = new Map<number, CompraParaRecalculo>();
      for (const l of linhas) {
        const compraId = numero(l.id);
        const compra = compras.get(compraId) ?? {
          compraId,
          descricao: String(l.descricao),
          dataCompra: String(l.data_compra),
          parcelas: [],
        };
        compras.set(compraId, {
          ...compra,
          parcelas: [
            ...compra.parcelas,
            { numero: numero(l.numero), competencia: String(l.competencia) },
          ],
        });
      }
      return [...compras.values()];
    },
    atualizarComParcelas: async (id, cartao, mudancas) => {
      const [existe] = await banco.select<Linha[]>(
        'SELECT 1 FROM cartoes WHERE id = ? AND deleted_at IS NULL',
        [id],
      );
      if (!existe) throw new RegistroNaoEncontrado('Cartão', id);
      await comandos.atualizarCartao(
        id,
        cartao,
        mudancas.flatMap((m) => m.parcelas.map((p) => ({ compraId: m.compraId, ...p }))),
      );
    },
  };
}

function comprasSqlite(banco: Banco, comandos: ComandosAtomicos): ComprasRepository {
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
      return comandos.salvarCompra(
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
    ultimasCategorias: async () => {
      const linhas = await banco.select<Linha[]>(
        `SELECT descricao, categoria_id FROM compras
         WHERE deleted_at IS NULL AND categoria_id IS NOT NULL
         ORDER BY id DESC LIMIT 500`,
      );
      return linhas.map((l) => ({
        descricao: String(l.descricao),
        categoriaId: numero(l.categoria_id),
      }));
    },
    buscar: async (id) => {
      const [c] = await banco.select<Linha[]>(
        `SELECT cartao_id, descricao, categoria_id, valor_total_centavos, num_parcelas,
                data_compra, recorrente, observacao
         FROM compras WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      if (!c) throw new RegistroNaoEncontrado('Compra', id);
      const [rateios, parcelas] = await Promise.all([
        banco.select<Linha[]>(
          'SELECT terceiro_id, percentual FROM rateios WHERE compra_id = ? ORDER BY rowid',
          [id],
        ),
        banco.select<Linha[]>(
          'SELECT numero, competencia, valor_centavos FROM parcelas WHERE compra_id = ? ORDER BY numero',
          [id],
        ),
      ]);
      return {
        id,
        cartaoId: numero(c.cartao_id),
        descricao: String(c.descricao),
        categoriaId: c.categoria_id === null ? null : numero(c.categoria_id),
        valorTotal: assertCentavos(numero(c.valor_total_centavos)),
        numParcelas: numero(c.num_parcelas),
        dataCompra: String(c.data_compra),
        recorrente: Boolean(c.recorrente),
        observacao: typeof c.observacao === 'string' ? c.observacao : null,
        rateios: rateios.map((r) => ({
          terceiroId: r.terceiro_id === null ? null : numero(r.terceiro_id),
          percentual: numero(r.percentual),
        })),
        parcelas: parcelas.map((p) => ({
          numero: numero(p.numero),
          competencia: String(p.competencia),
          valorCentavos: assertCentavos(numero(p.valor_centavos)),
        })),
      };
    },
    substituir: async function (id, dados, opcoes) {
      const atual = await this.buscar(id);
      const [cartao] = await banco.select<Linha[]>(
        'SELECT dia_fechamento FROM cartoes WHERE id = ? AND deleted_at IS NULL',
        [dados.cartaoId],
      );
      if (!cartao) throw new RegistroNaoEncontrado('Cartão', dados.cartaoId);
      const preparada = prepararNovaCompra(dados, { diaFechamento: numero(cartao.dia_fechamento) });
      await comandos.substituirCompra(id, {
        ...preparada,
        parcelas: opcoes?.manterParcelas ? atual.parcelas : preparada.parcelas,
      });
    },
    excluir: (id) =>
      exigirLinha(id, 'UPDATE compras SET deleted_at = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ]),
    restaurar: (id) => exigirLinha(id, 'UPDATE compras SET deleted_at = NULL WHERE id = ?', [id]),
  };
}

function faturasSqlite(banco: Banco): FaturasRepository {
  return {
    pagamentos: async () => {
      const linhas = await banco.select<Linha[]>(
        'SELECT cartao_id, competencia, pago_em, valor_pago_centavos FROM faturas ORDER BY competencia, cartao_id',
      );
      return linhas.map((l) => ({
        cartaoId: numero(l.cartao_id),
        competencia: String(l.competencia),
        pagoEm: String(l.pago_em),
        valorPagoCentavos: assertCentavos(numero(l.valor_pago_centavos)),
      }));
    },
    marcarComoPaga: async ({ cartaoId, competencia, pagoEm, valorPagoCentavos }) => {
      const [existe] = await banco.select<Linha[]>(
        'SELECT 1 FROM cartoes WHERE id = ? AND deleted_at IS NULL',
        [cartaoId],
      );
      if (!existe) throw new RegistroNaoEncontrado('Cartão', cartaoId);
      await banco.execute(
        `INSERT INTO faturas (cartao_id, competencia, pago_em, valor_pago_centavos) VALUES (?, ?, ?, ?)
         ON CONFLICT (cartao_id, competencia) DO UPDATE
         SET pago_em = excluded.pago_em, valor_pago_centavos = excluded.valor_pago_centavos`,
        [cartaoId, competencia, pagoEm, valorPagoCentavos],
      );
    },
    desmarcar: async (cartaoId, competencia) => {
      await banco.execute('DELETE FROM faturas WHERE cartao_id = ? AND competencia = ?', [
        cartaoId,
        competencia,
      ]);
    },
  };
}

export function criarRepositoriosSqlite(banco: Banco, comandos: ComandosAtomicos): Repositorios {
  return {
    cartoes: cartoesSqlite(banco, comandos),
    faturas: faturasSqlite(banco),
    categorias: cadastroSqlite<Categoria>(banco, {
      entidade: 'Categoria',
      tabela: 'categorias',
      colunas: { nome: 'nome', icone: 'icone', ativo: 'ativo' },
      usoSql: 'SELECT 1 FROM compras WHERE categoria_id = ?',
      gravar: { ativo: booleano },
      ler: (l) => ({
        id: numero(l.id),
        nome: String(l.nome),
        icone: String(l.icone),
        ativo: Boolean(l.ativo),
      }),
    }),
    terceiros: cadastroSqlite<Terceiro>(banco, {
      entidade: 'Terceiro',
      tabela: 'terceiros',
      colunas: { nome: 'nome', cor: 'cor', ativo: 'ativo' },
      usoSql: 'SELECT 1 FROM rateios WHERE terceiro_id = ?',
      gravar: { ativo: booleano },
      ler: (l) => ({
        id: numero(l.id),
        nome: String(l.nome),
        cor: String(l.cor),
        ativo: Boolean(l.ativo),
      }),
    }),
    compras: comprasSqlite(banco, comandos),
  };
}
