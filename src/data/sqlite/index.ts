import { chaveDaCobranca } from '@/domain/assinaturas';
import { type NovaCompraPreparada, prepararNovaCompra } from '@/domain/compras';
import type { CompraParaRecalculo } from '@/domain/faturas';
import type { ServicoDeBackup } from '../backup';
import type { ServicoDeSeguranca } from '../seguranca';
import { comMesesFechados } from '../fechamento';
import { assertCentavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';
import {
  type Assinatura,
  type Cadastro,
  type FechamentoRepository,
  type EconomiasRepository,
  type EmprestimoConcedido,
  type MovimentoDeEconomia,
  type Objetivo,
  type EmprestimosRepository,
  type EmprestimoTomado,
  type Cartao,
  type CartoesRepository,
  type FaturasRepository,
  PREFERENCIAS_PADRAO,
  type Preferencias,
  type PreferenciasRepository,
  type Movimento,
  type NovoDeposito,
  type Receita,
  type ReceberRepository,
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
  importarCompras(compras: NovaCompraPreparada[]): Promise<number[]>;
  registrarDeposito(deposito: NovoDeposito): Promise<number>;
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
  fixo?: Record<string, string>;
}

function cadastroSqlite<T extends { id: number }>(banco: Banco, m: Mapeamento<T>): Cadastro<T> {
  const campos = Object.keys(m.colunas) as (keyof Novo<T>)[];
  const fixos = Object.entries(m.fixo ?? {});
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
         WHERE deleted_at IS NULL${fixos.map(([c]) => ` AND ${c} = ?`).join('')} ORDER BY id`,
        fixos.map(([, v]) => v),
      );
      return linhas.map((l) => m.ler(l));
    },
    criar: async (novo) => {
      const { lastInsertId } = await banco.execute(
        `INSERT INTO ${m.tabela} (${[...campos.map((c) => m.colunas[c]), ...fixos.map(([c]) => c)].join(', ')})
         VALUES (${[...campos, ...fixos].map(() => '?').join(', ')})`,
        [...campos.map((c) => valor(c, novo[c])), ...fixos.map(([, v]) => v)],
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
  const lerParcelas = async (onde: string, params: unknown[]) => {
    const linhas = await banco.select<Linha[]>(
      `SELECT p.id AS parcela_id, p.compra_id, p.numero, p.competencia, p.valor_centavos,
              c.num_parcelas, c.descricao, c.data_compra, c.cartao_id, c.categoria_id, c.recorrente
       FROM parcelas p JOIN compras c ON c.id = p.compra_id
       WHERE ${onde} AND c.deleted_at IS NULL
       ORDER BY c.data_compra, p.id`,
      params,
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
  };

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
    listar: async () => {
      const linhas = await banco.select<Linha[]>(
        `SELECT id, data_compra, cartao_id, descricao, valor_total_centavos FROM compras
         WHERE deleted_at IS NULL ORDER BY id`,
      );
      return linhas.map((l) => ({
        id: numero(l.id),
        dataCompra: String(l.data_compra),
        cartaoId: numero(l.cartao_id),
        descricao: String(l.descricao),
        valorTotal: assertCentavos(numero(l.valor_total_centavos)),
      }));
    },
    importar: async (lista) => {
      const dias = new Map<number, number>();
      const preparadas: NovaCompraPreparada[] = [];
      for (const dados of lista) {
        if (!dias.has(dados.cartaoId)) {
          const [cartao] = await banco.select<Linha[]>(
            'SELECT dia_fechamento FROM cartoes WHERE id = ? AND deleted_at IS NULL',
            [dados.cartaoId],
          );
          if (!cartao) throw new RegistroNaoEncontrado('Cartão', dados.cartaoId);
          dias.set(dados.cartaoId, numero(cartao.dia_fechamento));
        }
        preparadas.push(
          prepararNovaCompra(dados, { diaFechamento: dias.get(dados.cartaoId) ?? 1 }),
        );
      }
      return comandos.importarCompras(preparadas);
    },
    parcelasDaCompetencia: (competencia) => lerParcelas('p.competencia = ?', [competencia]),
    parcelasDeTerceiros: (ate) =>
      lerParcelas(
        'p.competencia <= ? AND EXISTS (SELECT 1 FROM rateios r WHERE r.compra_id = c.id AND r.terceiro_id IS NOT NULL)',
        [ate],
      ),
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
      await this.buscar(id);
      const [cartao] = await banco.select<Linha[]>(
        'SELECT dia_fechamento FROM cartoes WHERE id = ? AND deleted_at IS NULL',
        [dados.cartaoId],
      );
      if (!cartao) throw new RegistroNaoEncontrado('Cartão', dados.cartaoId);
      const preparada = prepararNovaCompra(dados, { diaFechamento: numero(cartao.dia_fechamento) });
      await comandos.substituirCompra(id, {
        ...preparada,
        parcelas: opcoes?.parcelas ?? preparada.parcelas,
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

function preferenciasSqlite(banco: Banco): PreferenciasRepository {
  return {
    ler: async () => {
      const linhas = await banco.select<Linha[]>('SELECT chave, valor FROM preferencias');
      const salvas = Object.fromEntries(
        linhas.map((l) => [String(l.chave), JSON.parse(String(l.valor)) as unknown]),
      ) as Partial<Preferencias>;
      return { ...PREFERENCIAS_PADRAO, ...salvas };
    },
    gravar: async (mudanca) => {
      for (const [chave, valor] of Object.entries(mudanca)) {
        await banco.execute(
          'INSERT INTO preferencias (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
          [chave, JSON.stringify(valor)],
        );
      }
    },
  };
}

function emprestimosSqlite(banco: Banco): EmprestimosRepository {
  const data = (v: unknown) => String(v);
  return {
    tomados: cadastroSqlite<EmprestimoTomado>(banco, {
      entidade: 'Empréstimo',
      tabela: 'emprestimos',
      fixo: { tipo: 'tomado' },
      colunas: {
        descricao: 'descricao',
        valorCentavos: 'valor_centavos',
        numParcelas: 'num_parcelas',
        valorParcelaCentavos: 'valor_parcela_centavos',
        dia: 'dia',
        inicio: 'inicio',
        data: 'data',
      },
      usoSql: 'SELECT 1 FROM emprestimo_pagamentos WHERE emprestimo_id = ?',
      ler: (l) => ({
        id: numero(l.id),
        descricao: String(l.descricao),
        valorCentavos: assertCentavos(numero(l.valor_centavos)),
        numParcelas: numero(l.num_parcelas),
        valorParcelaCentavos: assertCentavos(numero(l.valor_parcela_centavos)),
        dia: numero(l.dia),
        inicio: data(l.inicio),
        data: data(l.data),
      }),
    }),
    concedidos: cadastroSqlite<EmprestimoConcedido>(banco, {
      entidade: 'Empréstimo',
      tabela: 'emprestimos',
      fixo: { tipo: 'concedido' },
      colunas: {
        terceiroId: 'terceiro_id',
        descricao: 'descricao',
        valorCentavos: 'valor_centavos',
        data: 'data',
        prazo: 'prazo',
      },
      usoSql: 'SELECT 1 FROM abatimentos WHERE emprestimo_id = ?',
      ler: (l) => ({
        id: numero(l.id),
        terceiroId: numero(l.terceiro_id),
        descricao: String(l.descricao),
        valorCentavos: assertCentavos(numero(l.valor_centavos)),
        data: data(l.data),
        prazo: data(l.prazo),
      }),
    }),
    pagamentos: async () => {
      const linhas = await banco.select<Linha[]>(
        'SELECT emprestimo_id, numero, pago_em FROM emprestimo_pagamentos ORDER BY emprestimo_id, numero',
      );
      return linhas.map((l) => ({
        emprestimoId: numero(l.emprestimo_id),
        numero: numero(l.numero),
        pagoEm: data(l.pago_em),
      }));
    },
    marcarPaga: async ({ emprestimoId, numero: n, pagoEm }) => {
      const [existe] = await banco.select<Linha[]>(
        "SELECT 1 FROM emprestimos WHERE id = ? AND tipo = 'tomado' AND deleted_at IS NULL",
        [emprestimoId],
      );
      if (!existe) throw new RegistroNaoEncontrado('Empréstimo', emprestimoId);
      await banco.execute(
        `INSERT INTO emprestimo_pagamentos (emprestimo_id, numero, pago_em) VALUES (?, ?, ?)
         ON CONFLICT (emprestimo_id, numero) DO UPDATE SET pago_em = excluded.pago_em`,
        [emprestimoId, n, pagoEm],
      );
    },
    desmarcar: async (emprestimoId, n) => {
      await banco.execute(
        'DELETE FROM emprestimo_pagamentos WHERE emprestimo_id = ? AND numero = ?',
        [emprestimoId, n],
      );
    },
  };
}

function economiasSqlite(banco: Banco): EconomiasRepository {
  const texto = (v: unknown) => String(v);
  return {
    metas: {
      listar: async () => {
        const linhas = await banco.select<Linha[]>(
          'SELECT valor_centavos, inicio FROM economia_metas ORDER BY inicio',
        );
        return linhas.map((l) => ({
          valorCentavos: assertCentavos(numero(l.valor_centavos)),
          inicio: texto(l.inicio),
        }));
      },
      definir: async ({ valorCentavos, inicio }) => {
        await banco.execute(
          `INSERT INTO economia_metas (valor_centavos, inicio) VALUES (?, ?)
           ON CONFLICT (inicio) DO UPDATE SET valor_centavos = excluded.valor_centavos`,
          [valorCentavos, inicio],
        );
      },
    },
    objetivos: cadastroSqlite<Objetivo>(banco, {
      entidade: 'Objetivo',
      tabela: 'economia_objetivos',
      colunas: { nome: 'nome', alvoCentavos: 'alvo_centavos', prazo: 'prazo' },
      usoSql: 'SELECT 1 FROM economia_movimentos WHERE objetivo_id = ?',
      ler: (l) => ({
        id: numero(l.id),
        nome: texto(l.nome),
        alvoCentavos: assertCentavos(numero(l.alvo_centavos)),
        prazo: l.prazo === null ? null : texto(l.prazo),
      }),
    }),
    movimentos: cadastroSqlite<MovimentoDeEconomia>(banco, {
      entidade: 'Registro',
      tabela: 'economia_movimentos',
      colunas: { data: 'data', valorCentavos: 'valor_centavos', objetivoId: 'objetivo_id' },
      usoSql: 'SELECT 1 WHERE 0 = ?',
      ler: (l) => ({
        id: numero(l.id),
        data: texto(l.data),
        valorCentavos: assertCentavos(numero(l.valor_centavos)),
        objetivoId: l.objetivo_id === null ? null : numero(l.objetivo_id),
      }),
    }),
  };
}

function receberSqlite(banco: Banco, comandos: ComandosAtomicos): ReceberRepository {
  const exigirLinha = async (id: number, sql: string, params: unknown[]) => {
    const { rowsAffected } = await banco.execute(sql, params);
    if (rowsAffected === 0) throw new RegistroNaoEncontrado('Movimento', id);
  };
  return {
    movimentos: async () => {
      const [linhas, abatimentos] = await Promise.all([
        banco.select<Linha[]>(
          `SELECT id, terceiro_id, tipo, valor_centavos, data, competencia FROM movimentos
           WHERE deleted_at IS NULL ORDER BY data, id`,
        ),
        banco.select<Linha[]>(
          'SELECT movimento_id, compra_id, numero, emprestimo_id, valor_centavos FROM abatimentos',
        ),
      ]);
      return linhas.map((l): Movimento => ({
        id: numero(l.id),
        terceiroId: numero(l.terceiro_id),
        tipo: l.tipo === 'cobranca' ? 'cobranca' : 'deposito',
        valorCentavos: assertCentavos(numero(l.valor_centavos)),
        data: String(l.data),
        competencia: String(l.competencia),
        abatimentos: abatimentos
          .filter((a) => numero(a.movimento_id) === numero(l.id))
          .map((a) => {
            const valor = assertCentavos(numero(a.valor_centavos));
            return a.emprestimo_id === null
              ? { compraId: numero(a.compra_id), numero: numero(a.numero), valor }
              : { emprestimoId: numero(a.emprestimo_id), valor };
          }),
      }));
    },
    registrarDeposito: async (deposito) => {
      const [existe] = await banco.select<Linha[]>(
        'SELECT 1 FROM terceiros WHERE id = ? AND deleted_at IS NULL',
        [deposito.terceiroId],
      );
      if (!existe) throw new RegistroNaoEncontrado('Terceiro', deposito.terceiroId);
      return comandos.registrarDeposito(deposito);
    },
    registrarCobranca: async ({ terceiroId, valorCentavos, data, competencia }) => {
      const { lastInsertId } = await banco.execute(
        `INSERT INTO movimentos (terceiro_id, tipo, valor_centavos, data, competencia)
         VALUES (?, 'cobranca', ?, ?, ?)`,
        [terceiroId, valorCentavos, data, competencia],
      );
      return Number(lastInsertId);
    },
    excluir: (id) =>
      exigirLinha(id, 'UPDATE movimentos SET deleted_at = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ]),
    restaurar: (id) =>
      exigirLinha(id, 'UPDATE movimentos SET deleted_at = NULL WHERE id = ?', [id]),
  };
}

function fechamentoSqlite(banco: Banco): FechamentoRepository {
  return {
    fechados: async () => {
      const linhas = await banco.select<Linha[]>(
        'SELECT competencia FROM meses_fechados ORDER BY competencia',
      );
      return linhas.map((l) => String(l.competencia));
    },
    fechar: async (competencia, em) => {
      await banco.execute(
        `INSERT INTO meses_fechados (competencia, fechado_em) VALUES (?, ?)
         ON CONFLICT (competencia) DO UPDATE SET fechado_em = excluded.fechado_em`,
        [competencia, em],
      );
    },
    reabrir: async (competencia) => {
      await banco.execute('DELETE FROM meses_fechados WHERE competencia = ?', [competencia]);
    },
    conferencias: async () => {
      const linhas = await banco.select<Linha[]>(
        'SELECT cartao_id, competencia, extrato, conferida_em FROM conferencias',
      );
      return linhas.map((l) => ({
        cartaoId: numero(l.cartao_id),
        competencia: String(l.competencia),
        extrato: typeof l.extrato === 'string' ? l.extrato : null,
        conferidaEm: String(l.conferida_em),
      }));
    },
    conferir: async ({ cartaoId, competencia, extrato, conferidaEm }) => {
      await banco.execute(
        `INSERT INTO conferencias (cartao_id, competencia, extrato, conferida_em) VALUES (?, ?, ?, ?)
         ON CONFLICT (cartao_id, competencia)
         DO UPDATE SET extrato = excluded.extrato, conferida_em = excluded.conferida_em`,
        [cartaoId, competencia, extrato, conferidaEm],
      );
    },
    desconferir: async (cartaoId, competencia) => {
      await banco.execute('DELETE FROM conferencias WHERE cartao_id = ? AND competencia = ?', [
        cartaoId,
        competencia,
      ]);
    },
  };
}

export function criarRepositoriosSqlite(
  banco: Banco,
  comandos: ComandosAtomicos,
  backup: ServicoDeBackup,
  seguranca: ServicoDeSeguranca,
): Repositorios {
  return comMesesFechados({
    fechamento: fechamentoSqlite(banco),
    backup,
    seguranca,
    receber: receberSqlite(banco, comandos),
    cartoes: cartoesSqlite(banco, comandos),
    faturas: faturasSqlite(banco),
    preferencias: preferenciasSqlite(banco),
    receitas: cadastroSqlite<Receita>(banco, {
      entidade: 'Receita',
      tabela: 'receitas',
      colunas: {
        descricao: 'descricao',
        valorCentavos: 'valor_centavos',
        competencia: 'competencia',
        competenciaFim: 'competencia_fim',
        recorrente: 'recorrente',
      },
      usoSql: 'SELECT 1 WHERE 0 = ?',
      gravar: { recorrente: booleano },
      ler: (l) => ({
        id: numero(l.id),
        descricao: String(l.descricao),
        valorCentavos: assertCentavos(numero(l.valor_centavos)),
        competencia: String(l.competencia),
        competenciaFim: typeof l.competencia_fim === 'string' ? l.competencia_fim : null,
        recorrente: Boolean(l.recorrente),
      }),
    }),
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
    emprestimos: emprestimosSqlite(banco),
    economias: economiasSqlite(banco),
    assinaturas: {
      ...cadastroSqlite<Assinatura>(banco, {
        entidade: 'Assinatura',
        tabela: 'assinaturas',
        colunas: {
          nome: 'nome',
          cartaoId: 'cartao_id',
          categoriaId: 'categoria_id',
          valorCentavos: 'valor_centavos',
          dia: 'dia',
          rateios: 'rateios',
          ativa: 'ativa',
          inicio: 'inicio',
        },
        usoSql: 'SELECT 1 FROM compras WHERE assinatura_id = ?',
        gravar: { ativa: booleano, rateios: (v) => JSON.stringify(v) },
        ler: (l) => ({
          id: numero(l.id),
          nome: String(l.nome),
          cartaoId: numero(l.cartao_id),
          categoriaId: l.categoria_id === null ? null : numero(l.categoria_id),
          valorCentavos: assertCentavos(numero(l.valor_centavos)),
          dia: numero(l.dia),
          rateios: JSON.parse(String(l.rateios)) as Rateio[],
          ativa: Boolean(l.ativa),
          inicio: String(l.inicio),
        }),
      }),
      geradas: async () => {
        const linhas = await banco.select<Linha[]>(
          'SELECT assinatura_id, assinatura_mes FROM compras WHERE assinatura_id IS NOT NULL',
        );
        return linhas.map((l) =>
          chaveDaCobranca(numero(l.assinatura_id), String(l.assinatura_mes)),
        );
      },
    },
  });
}
