import { competenciaDe, type DataLocal, dataNaCompetencia, diaDe, somarMeses } from './competencia';
import { linhasPorDono } from './faturas';
import type { Celula } from './importacao';
import type { Centavos } from './money';
import type { Rateio } from './terceiros';

export const CABECALHO = ['Data', 'Descrição', 'Valor', 'Parcela', 'Responsável', 'Categoria'];

export interface ParcelaExportada {
  numero: number;
  numParcelas: number;
  valorCentavos: Centavos;
  descricao: string;
  dataCompra: DataLocal;
  cartaoId: number;
  categoriaId: number | null;
  recorrente: boolean;
  rateios: Rateio[];
}

interface Nomeado {
  id: number;
  nome: string;
}

export interface AbaExportada {
  nome: string;
  linhas: Celula[][];
}

const LIMITE_DO_NOME_DA_ABA = 31;

const nomeDaAba = (nome: string) =>
  nome
    .replace(/[[\]:*?/\\]/g, '')
    .slice(0, LIMITE_DO_NOME_DA_ABA)
    .trim() || 'Cartão';

const dataDaParcela = (p: ParcelaExportada) =>
  dataNaCompetencia(somarMeses(competenciaDe(p.dataCompra), p.numero - 1), diaDe(p.dataCompra));

export function abasDaExportacao(
  parcelas: readonly ParcelaExportada[],
  cadastros: {
    cartoes: readonly Nomeado[];
    terceiros: readonly Nomeado[];
    categorias: readonly Nomeado[];
  },
): AbaExportada[] {
  const nome = (lista: readonly Nomeado[], id: number | null) =>
    lista.find((x) => x.id === id)?.nome ?? '';
  const usados = new Set<string>();

  return cadastros.cartoes.flatMap((cartao): AbaExportada[] => {
    const doCartao = parcelas
      .filter((p) => p.cartaoId === cartao.id)
      .map((p) => ({ ...p, data: dataDaParcela(p) }))
      .sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao));
    if (doCartao.length === 0) return [];

    const base = nomeDaAba(cartao.nome);
    let aba = base;
    for (let n = 2; usados.has(aba); n++) {
      const sufixo = ` (${String(n)})`;
      aba = base.slice(0, LIMITE_DO_NOME_DA_ABA - sufixo.length) + sufixo;
    }
    usados.add(aba);

    const linhas = doCartao.flatMap((p) =>
      linhasPorDono([{ parcelaId: 0, valorCentavos: p.valorCentavos, rateios: p.rateios }]).map(
        ({ dono, valorCentavos }): Celula[] => [
          p.data,
          p.descricao,
          valorCentavos / 100,
          p.numParcelas > 1 ? `${String(p.numero)} de ${String(p.numParcelas)}` : '',
          dono === null ? (p.recorrente ? 'Recorrente' : 'Eu') : nome(cadastros.terceiros, dono),
          nome(cadastros.categorias, p.categoriaId),
        ],
      ),
    );
    return [{ nome: aba, linhas: [CABECALHO, ...linhas] }];
  });
}
