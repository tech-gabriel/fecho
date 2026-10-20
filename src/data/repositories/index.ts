import type { Competencia, DataLocal } from '@/domain/competencia';
import type { DadosNovaCompra } from '@/domain/compras';
import type { CompraParaRecalculo, MudancaDeFatura } from '@/domain/faturas';
import type { Centavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';

export interface Cartao {
  id: number;
  nome: string;
  diaFechamento: number;
  diaVencimento: number;
  limiteCentavos: Centavos;
  cor: string;
  ativo: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  icone: string;
  ativo: boolean;
}

export interface Terceiro {
  id: number;
  nome: string;
  cor: string;
  ativo: boolean;
}

export type Novo<T> = Omit<T, 'id'>;

export interface Cadastro<T extends { id: number }> {
  listar(): Promise<T[]>;
  criar(novo: Novo<T>): Promise<number>;
  atualizar(id: number, dados: Partial<Novo<T>>): Promise<void>;
  excluir(id: number): Promise<void>;
  restaurar(id: number): Promise<void>;
  possuiCompras(id: number): Promise<boolean>;
}

export interface CartoesRepository extends Cadastro<Cartao> {
  comprasParaRecalculo(id: number): Promise<CompraParaRecalculo[]>;
  atualizarComParcelas(
    id: number,
    cartao: Novo<Cartao>,
    mudancas: readonly MudancaDeFatura[],
  ): Promise<void>;
}

export interface ParcelaDoMes {
  parcelaId: number;
  compraId: number;
  numero: number;
  numParcelas: number;
  competencia: Competencia;
  valorCentavos: Centavos;
  descricao: string;
  dataCompra: DataLocal;
  cartaoId: number;
  categoriaId: number | null;
  recorrente: boolean;
  rateios: Rateio[];
}

export interface ComprasRepository {
  salvar(dados: DadosNovaCompra): Promise<number>;
  parcelasDaCompetencia(competencia: Competencia): Promise<ParcelaDoMes[]>;
  ultimasCategorias(): Promise<{ descricao: string; categoriaId: number }[]>;
  excluir(id: number): Promise<void>;
  restaurar(id: number): Promise<void>;
}

export interface Repositorios {
  cartoes: CartoesRepository;
  categorias: Cadastro<Categoria>;
  terceiros: Cadastro<Terceiro>;
  compras: ComprasRepository;
}

export class RegistroNaoEncontrado extends Error {
  constructor(entidade: string, id: number) {
    super(`${entidade} ${id} não encontrado`);
    this.name = 'RegistroNaoEncontrado';
  }
}
