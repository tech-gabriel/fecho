import type { Competencia, DataLocal } from '@/domain/competencia';
import type { DadosNovaCompra } from '@/domain/compras';
import type { Centavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';

export interface Cartao {
  id: number;
  nome: string;
  diaFechamento: number;
  diaVencimento: number;
  limiteCentavos: Centavos;
  cor: string;
}

export interface Categoria {
  id: number;
  nome: string;
  icone: string;
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
  excluir(id: number): Promise<void>;
  restaurar(id: number): Promise<void>;
}

export interface Repositorios {
  cartoes: Cadastro<Cartao>;
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
