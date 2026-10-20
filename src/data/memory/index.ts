import { prepararNovaCompra, type Compra } from '@/domain/compras';
import type { Parcela } from '@/domain/parcelas';
import type { Rateio } from '@/domain/terceiros';
import {
  type Cadastro,
  type Cartao,
  type CartoesRepository,
  type PagamentoDeFatura,
  PREFERENCIAS_PADRAO,
  type Preferencias,
  type Receita,
  type Categoria,
  type ComprasRepository,
  type Novo,
  type ParcelaDoMes,
  RegistroNaoEncontrado,
  type Repositorios,
  type Terceiro,
} from '../repositories';
import { backupIndisponivel } from '../backup';

type CompraGravada = Compra & { id: number; rateios: Rateio[]; excluido: boolean };
type ParcelaGravada = Parcela & { id: number; compraId: number };

function cadastroEmMemoria<T extends { id: number }>(
  entidade: string,
  usadoEm: (id: number) => boolean,
) {
  const linhas: T[] = [];
  const excluidos = new Set<number>();
  let proximoId = 1;

  const buscar = (id: number) => {
    const linha = linhas.find((l) => l.id === id);
    if (!linha) throw new RegistroNaoEncontrado(entidade, id);
    return linha;
  };

  const cadastro: Cadastro<T> & { vigente(id: number): T } = {
    listar: () =>
      Promise.resolve(linhas.filter((l) => !excluidos.has(l.id)).map((l) => ({ ...l }))),
    criar: (novo: Novo<T>) => {
      const id = proximoId++;
      linhas.push({ ...novo, id } as T);
      return Promise.resolve(id);
    },
    atualizar: async (id, dados) => {
      Object.assign(buscar(id), dados);
    },
    excluir: async (id) => {
      excluidos.add(buscar(id).id);
    },
    restaurar: async (id) => {
      excluidos.delete(buscar(id).id);
    },
    possuiCompras: async (id) => usadoEm(id),
    vigente: (id) => {
      const linha = buscar(id);
      if (excluidos.has(id)) throw new RegistroNaoEncontrado(entidade, id);
      return linha;
    },
  };
  return cadastro;
}

function comprasEmMemoria(
  compras: CompraGravada[],
  parcelas: ParcelaGravada[],
  cartaoVigente: (id: number) => Cartao,
) {
  let proximaParcela = 1;
  const buscar = (id: number) => {
    const compra = compras.find((c) => c.id === id);
    if (!compra) throw new RegistroNaoEncontrado('Compra', id);
    return compra;
  };
  const vigente = (id: number) => {
    const compra = buscar(id);
    if (compra.excluido) throw new RegistroNaoEncontrado('Compra', id);
    return compra;
  };
  const parcelasDa = (compraId: number) =>
    parcelas
      .filter((p) => p.compraId === compraId)
      .sort((a, b) => a.numero - b.numero)
      .map(({ numero, competencia, valorCentavos }) => ({ numero, competencia, valorCentavos }));

  const repositorio: ComprasRepository = {
    salvar: async (dados) => {
      const preparada = prepararNovaCompra(dados, cartaoVigente(dados.cartaoId));
      const id = compras.length + 1;
      compras.push({ ...preparada.compra, id, rateios: preparada.rateios, excluido: false });
      for (const parcela of preparada.parcelas) {
        parcelas.push({ ...parcela, id: proximaParcela++, compraId: id });
      }
      return id;
    },
    parcelasDaCompetencia: async (competencia) =>
      parcelas
        .filter((p) => p.competencia === competencia && !buscar(p.compraId).excluido)
        .map((p): ParcelaDoMes => {
          const compra = buscar(p.compraId);
          return {
            parcelaId: p.id,
            compraId: compra.id,
            numero: p.numero,
            numParcelas: compra.numParcelas,
            competencia: p.competencia,
            valorCentavos: p.valorCentavos,
            descricao: compra.descricao,
            dataCompra: compra.dataCompra,
            cartaoId: compra.cartaoId,
            categoriaId: compra.categoriaId,
            recorrente: compra.recorrente,
            rateios: compra.rateios.map((r) => ({ ...r })),
          };
        })
        .sort((a, b) => a.dataCompra.localeCompare(b.dataCompra) || a.parcelaId - b.parcelaId),
    ultimasCategorias: async () =>
      compras
        .filter((c) => !c.excluido && c.categoriaId !== null)
        .reverse()
        .slice(0, 500)
        .map((c) => ({ descricao: c.descricao, categoriaId: Number(c.categoriaId) })),
    buscar: async (id) => {
      const c = vigente(id);
      return {
        id: c.id,
        cartaoId: c.cartaoId,
        descricao: c.descricao,
        categoriaId: c.categoriaId,
        valorTotal: c.valorTotalCentavos,
        numParcelas: c.numParcelas,
        dataCompra: c.dataCompra,
        recorrente: c.recorrente,
        observacao: c.observacao,
        rateios: c.rateios.map((r) => ({ ...r })),
        parcelas: parcelasDa(id),
      };
    },
    substituir: async (id, dados, opcoes) => {
      const atual = vigente(id);
      const preparada = prepararNovaCompra(dados, cartaoVigente(dados.cartaoId));
      const novas = opcoes?.parcelas ?? preparada.parcelas;
      Object.assign(atual, preparada.compra, { rateios: preparada.rateios });
      for (let i = parcelas.length - 1; i >= 0; i--) {
        if (parcelas[i]?.compraId === id) parcelas.splice(i, 1);
      }
      for (const parcela of novas) {
        parcelas.push({ ...parcela, id: proximaParcela++, compraId: id });
      }
    },
    excluir: async (id) => {
      buscar(id).excluido = true;
    },
    restaurar: async (id) => {
      buscar(id).excluido = false;
    },
  };
  return repositorio;
}

export function criarRepositoriosEmMemoria(): Repositorios {
  const compras: CompraGravada[] = [];
  const parcelas: ParcelaGravada[] = [];

  const cadastroCartoes = cadastroEmMemoria<Cartao>('Cartão', (id) =>
    compras.some((c) => c.cartaoId === id),
  );
  const cartoes: CartoesRepository = {
    ...cadastroCartoes,
    comprasParaRecalculo: async (id) =>
      compras
        .filter((c) => c.cartaoId === id && !c.excluido)
        .map((c) => ({
          compraId: c.id,
          descricao: c.descricao,
          dataCompra: c.dataCompra,
          parcelas: parcelas
            .filter((p) => p.compraId === c.id)
            .map((p) => ({ numero: p.numero, competencia: p.competencia })),
        })),
    atualizarComParcelas: async (id, cartao, mudancas) => {
      cadastroCartoes.vigente(id);
      const alvos = mudancas.flatMap((m) =>
        m.parcelas.map((nova) => {
          const parcela = parcelas.find(
            (p) =>
              p.compraId === m.compraId &&
              p.numero === nova.numero &&
              compras.some((c) => c.id === p.compraId && c.cartaoId === id),
          );
          if (!parcela) throw new RegistroNaoEncontrado('Parcela', nova.numero);
          return { parcela, competencia: nova.competencia };
        }),
      );
      for (const { parcela, competencia } of alvos) parcela.competencia = competencia;
      await cadastroCartoes.atualizar(id, cartao);
    },
  };

  let pagamentos: PagamentoDeFatura[] = [];
  const mesmaFatura = (p: PagamentoDeFatura, cartaoId: number, competencia: string) =>
    p.cartaoId === cartaoId && p.competencia === competencia;

  let preferencias: Preferencias = { ...PREFERENCIAS_PADRAO };

  return {
    backup: backupIndisponivel,
    receitas: cadastroEmMemoria<Receita>('Receita', () => false),
    preferencias: {
      ler: async () => ({ ...preferencias }),
      gravar: async (mudanca) => {
        preferencias = { ...preferencias, ...mudanca };
      },
    },
    faturas: {
      pagamentos: async () =>
        pagamentos
          .map((p) => ({ ...p }))
          .sort((a, b) => a.competencia.localeCompare(b.competencia) || a.cartaoId - b.cartaoId),
      marcarComoPaga: async (pagamento) => {
        cadastroCartoes.vigente(pagamento.cartaoId);
        pagamentos = [
          ...pagamentos.filter((p) => !mesmaFatura(p, pagamento.cartaoId, pagamento.competencia)),
          { ...pagamento },
        ];
      },
      desmarcar: async (cartaoId, competencia) => {
        pagamentos = pagamentos.filter((p) => !mesmaFatura(p, cartaoId, competencia));
      },
    },
    cartoes,
    categorias: cadastroEmMemoria<Categoria>('Categoria', (id) =>
      compras.some((c) => c.categoriaId === id),
    ),
    terceiros: cadastroEmMemoria<Terceiro>('Terceiro', (id) =>
      compras.some((c) => c.rateios.some((r) => r.terceiroId === id)),
    ),
    compras: comprasEmMemoria(compras, parcelas, (id) => cadastroCartoes.vigente(id)),
  };
}
