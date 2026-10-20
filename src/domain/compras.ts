import type { Competencia, DataLocal } from './competencia';
import { type DiasDoCartao, datasDaFatura } from './faturas';
import type { Centavos } from './money';
import { type Parcela, gerarParcelas } from './parcelas';
import { type Rateio, ratear, validarRateio } from './terceiros';

export interface DadosNovaCompra {
  cartaoId: number;
  descricao: string;
  categoriaId: number | null;
  valorTotal: Centavos;
  numParcelas: number;
  dataCompra: DataLocal;
  recorrente: boolean;
  rateios: readonly Rateio[];
  observacao?: string | null;
  assinatura?: { id: number; mes: Competencia };
}

export interface Compra {
  cartaoId: number;
  descricao: string;
  categoriaId: number | null;
  valorTotalCentavos: Centavos;
  numParcelas: number;
  dataCompra: DataLocal;
  recorrente: boolean;
  observacao: string | null;
  assinaturaId: number | null;
  assinaturaMes: Competencia | null;
}

export interface NovaCompraPreparada {
  compra: Compra;
  rateios: Rateio[];
  parcelas: Parcela[];
}

export function prepararNovaCompra(
  dados: DadosNovaCompra,
  cartao: { diaFechamento: number },
): NovaCompraPreparada {
  const descricao = dados.descricao.trim();
  if (!descricao) throw new RangeError('Digite uma descrição');

  validarRateio(dados.rateios);
  const soMeu = dados.rateios.every((r) => r.terceiroId === null);

  return {
    compra: {
      cartaoId: dados.cartaoId,
      descricao,
      categoriaId: dados.categoriaId,
      valorTotalCentavos: dados.valorTotal,
      numParcelas: dados.numParcelas,
      dataCompra: dados.dataCompra,
      recorrente: dados.recorrente,
      observacao: dados.observacao?.trim() || null,
      assinaturaId: dados.assinatura?.id ?? null,
      assinaturaMes: dados.assinatura?.mes ?? null,
    },
    rateios: soMeu ? [] : [...dados.rateios],
    parcelas: gerarParcelas(dados, cartao),
  };
}

const semAcento = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const primeiraPalavra = (texto: string) => semAcento(texto).split(/\s+/)[0] ?? '';

const PALAVRAS_DAS_CATEGORIAS: [string, string][] = [
  ['supermerc', 'mercado'],
  ['mercado', 'mercado'],
  ['atacad', 'mercado'],
  ['padaria', 'mercado'],
  ['ifood', 'restaurante'],
  ['restaurante', 'restaurante'],
  ['lanchonete', 'restaurante'],
  ['uber', 'transporte'],
  ['99', 'transporte'],
  ['posto', 'transporte'],
  ['estacionamento', 'transporte'],
  ['farm', 'saude'],
  ['drog', 'saude'],
  ['hospital', 'saude'],
  ['netflix', 'assinaturas'],
  ['spotify', 'assinaturas'],
  ['cinema', 'lazer'],
  ['show', 'lazer'],
  ['escola', 'educacao'],
  ['curso', 'educacao'],
];

export function sugerirCategoria(
  descricao: string,
  historico: readonly { descricao: string; categoriaId: number }[],
  categorias: readonly { id: number; nome: string; ativo: boolean }[],
): number | null {
  const palavra = primeiraPalavra(descricao);
  if (!palavra) return null;
  const ativa = (id: number | undefined) =>
    categorias.some((c) => c.id === id && c.ativo) ? (id ?? null) : null;

  const doHistorico = historico.find((h) => primeiraPalavra(h.descricao) === palavra);
  if (doHistorico) return ativa(doHistorico.categoriaId);

  const texto = semAcento(descricao);
  const nome = PALAVRAS_DAS_CATEGORIAS.find(([chave]) => texto.includes(chave))?.[1];
  return ativa(categorias.find((c) => semAcento(c.nome) === nome)?.id);
}

export type ModoDaCompra = 'minha' | 'outra' | 'dividida';

export function rateioDaCompra(modo: ModoDaCompra, pessoas: readonly Rateio[]): Rateio[] {
  if (modo === 'minha') return [];
  if (modo === 'outra') {
    const pessoa = pessoas[0];
    if (!pessoa) throw new RangeError('Escolha uma pessoa');
    return [{ terceiroId: pessoa.terceiroId, percentual: 100 }];
  }

  if (pessoas.length === 0) throw new RangeError('Escolha pelo menos uma pessoa');
  if (
    pessoas.some((p) => !Number.isInteger(p.percentual) || p.percentual < 1 || p.percentual > 100)
  ) {
    throw new RangeError('Use um percentual de 1 a 100');
  }
  const resto = 100 - pessoas.reduce((soma, p) => soma + p.percentual, 0);
  if (resto < 0) throw new RangeError('A soma passa de 100%');
  return resto > 0 ? [...pessoas, { terceiroId: null, percentual: resto }] : [...pessoas];
}

export interface ParcelaDaPrevia {
  numero: number;
  competencia: Competencia;
  vencimento: DataLocal;
  valorCentavos: Centavos;
  porTerceiro: Map<number, Centavos>;
}

export function previaDaCompra(
  compra: Pick<DadosNovaCompra, 'valorTotal' | 'numParcelas' | 'dataCompra' | 'rateios'>,
  cartao: DiasDoCartao,
): ParcelaDaPrevia[] {
  return gerarParcelas(compra, cartao).map((p) => ({
    numero: p.numero,
    competencia: p.competencia,
    vencimento: datasDaFatura(p.competencia, cartao).vencimento,
    valorCentavos: p.valorCentavos,
    porTerceiro: ratear(p.valorCentavos, compra.rateios).porTerceiro,
  }));
}
