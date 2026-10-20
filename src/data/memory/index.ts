import { prepararNovaCompra, type Compra } from '@/domain/compras';
import type { Parcela } from '@/domain/parcelas';
import type { Rateio } from '@/domain/terceiros';
import {
  type Cadastro,
  type Cartao,
  type ComprasRepository,
  type Novo,
  type ParcelaDoMes,
  RegistroNaoEncontrado,
  type Repositorios,
} from '../repositories';

function cadastroEmMemoria<T extends { id: number }>(entidade: string) {
  const linhas: T[] = [];
  const excluidos = new Set<number>();
  let proximoId = 1;

  const buscar = (id: number) => {
    const linha = linhas.find((l) => l.id === id);
    if (!linha) throw new RegistroNaoEncontrado(entidade, id);
    return linha;
  };

  const cadastro: Cadastro<T> & { ativo(id: number): T } = {
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
    ativo: (id) => {
      const linha = buscar(id);
      if (excluidos.has(id)) throw new RegistroNaoEncontrado(entidade, id);
      return linha;
    },
  };
  return cadastro;
}

function comprasEmMemoria(cartoes: ReturnType<typeof cadastroEmMemoria<Cartao>>) {
  const compras: (Compra & { id: number; rateios: Rateio[]; excluido: boolean })[] = [];
  const parcelas: (Parcela & { id: number; compraId: number })[] = [];

  const buscar = (id: number) => {
    const compra = compras.find((c) => c.id === id);
    if (!compra) throw new RegistroNaoEncontrado('Compra', id);
    return compra;
  };

  const repositorio: ComprasRepository = {
    salvar: async (dados) => {
      const preparada = prepararNovaCompra(dados, cartoes.ativo(dados.cartaoId));
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
  const cartoes = cadastroEmMemoria<Cartao>('Cartão');
  return {
    cartoes,
    categorias: cadastroEmMemoria('Categoria'),
    terceiros: cadastroEmMemoria('Terceiro'),
    compras: comprasEmMemoria(cartoes),
  };
}
