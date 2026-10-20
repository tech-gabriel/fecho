import { prepararNovaCompra, type Compra } from '@/domain/compras';
import type { Parcela } from '@/domain/parcelas';
import type { Rateio } from '@/domain/terceiros';
import {
  type Cadastro,
  type Cartao,
  type CartoesRepository,
  type PagamentoDeFatura,
  type Categoria,
  type ComprasRepository,
  type Novo,
  type ParcelaDoMes,
  RegistroNaoEncontrado,
  type Repositorios,
  type Terceiro,
} from '../repositories';

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
  const buscar = (id: number) => {
    const compra = compras.find((c) => c.id === id);
    if (!compra) throw new RegistroNaoEncontrado('Compra', id);
    return compra;
  };

  const repositorio: ComprasRepository = {
    salvar: async (dados) => {
      const preparada = prepararNovaCompra(dados, cartaoVigente(dados.cartaoId));
      const id = compras.length + 1;
      compras.push({ ...preparada.compra, id, rateios: preparada.rateios, excluido: false });
      for (const parcela of preparada.parcelas) {
        parcelas.push({ ...parcela, id: parcelas.length + 1, compraId: id });
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

  return {
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
