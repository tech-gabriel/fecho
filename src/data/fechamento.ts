import type { DadosNovaCompra } from '@/domain/compras';
import { prepararNovaCompra } from '@/domain/compras';
import type { Competencia } from '@/domain/competencia';
import { mesFechadoEntre } from '@/domain/fechamento';
import { MesFechado, type Repositorios } from './repositories';

export function comMesesFechados(repos: Repositorios): Repositorios {
  const exigirAbertos = async (competencias: readonly Competencia[]) => {
    if (competencias.length === 0) return;
    const fechado = mesFechadoEntre(competencias, new Set(await repos.fechamento.fechados()));
    if (fechado) throw new MesFechado(fechado);
  };
  const daNova = async (dados: DadosNovaCompra) => {
    const cartao = (await repos.cartoes.listar()).find((c) => c.id === dados.cartaoId);
    try {
      return cartao ? prepararNovaCompra(dados, cartao).parcelas.map((p) => p.competencia) : [];
    } catch {
      return [];
    }
  };
  const daGravada = async (id: number) => {
    try {
      return (await repos.compras.buscar(id)).parcelas.map((p) => p.competencia);
    } catch {
      return [];
    }
  };

  return {
    ...repos,
    compras: {
      ...repos.compras,
      salvar: async (dados) => {
        await exigirAbertos(await daNova(dados));
        return repos.compras.salvar(dados);
      },
      importar: async (lista) => {
        await exigirAbertos((await Promise.all(lista.map(daNova))).flat());
        return repos.compras.importar(lista);
      },
      substituir: async (id, dados, opcoes) => {
        const novas = opcoes?.parcelas
          ? opcoes.parcelas.map((p) => p.competencia)
          : await daNova(dados);
        await exigirAbertos([...(await daGravada(id)), ...novas]);
        return repos.compras.substituir(id, dados, opcoes);
      },
      excluir: async (id) => {
        await exigirAbertos(await daGravada(id));
        return repos.compras.excluir(id);
      },
    },
    cartoes: {
      ...repos.cartoes,
      atualizarComParcelas: async (id, cartao, mudancas) => {
        await exigirAbertos(
          mudancas.flatMap((m) => [m.de, m.para, ...m.parcelas.map((p) => p.competencia)]),
        );
        return repos.cartoes.atualizarComParcelas(id, cartao, mudancas);
      },
    },
    faturas: {
      ...repos.faturas,
      marcarComoPaga: async (pagamento) => {
        await exigirAbertos([pagamento.competencia]);
        return repos.faturas.marcarComoPaga(pagamento);
      },
      desmarcar: async (cartaoId, competencia) => {
        await exigirAbertos([competencia]);
        return repos.faturas.desmarcar(cartaoId, competencia);
      },
    },
  };
}
