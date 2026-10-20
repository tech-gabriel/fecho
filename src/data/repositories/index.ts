import type { Competencia, DataLocal } from '@/domain/competencia';
import type { DadosNovaCompra } from '@/domain/compras';
import type { Parcela } from '@/domain/parcelas';
import type { ServicoDeBackup } from '../backup';
import type { CompraParaRecalculo, MudancaDeFatura } from '@/domain/faturas';
import type { Centavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';
import type { TipoDeAlerta } from '@/domain/alertas';

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

export interface CompraGravada extends DadosNovaCompra {
  id: number;
  observacao: string | null;
  rateios: Rateio[];
  parcelas: Parcela[];
}

export interface ComprasRepository {
  salvar(dados: DadosNovaCompra): Promise<number>;
  importar(compras: readonly DadosNovaCompra[]): Promise<number[]>;
  listar(): Promise<
    {
      id: number;
      dataCompra: DataLocal;
      cartaoId: number;
      descricao: string;
      valorTotal: Centavos;
    }[]
  >;
  parcelasDaCompetencia(competencia: Competencia): Promise<ParcelaDoMes[]>;
  parcelasDeTerceiros(ate: Competencia): Promise<ParcelaDoMes[]>;
  ultimasCategorias(): Promise<{ descricao: string; categoriaId: number }[]>;
  buscar(id: number): Promise<CompraGravada>;
  substituir(id: number, dados: DadosNovaCompra, opcoes?: { parcelas?: Parcela[] }): Promise<void>;
  excluir(id: number): Promise<void>;
  restaurar(id: number): Promise<void>;
}

export interface PagamentoDeFatura {
  cartaoId: number;
  competencia: Competencia;
  pagoEm: DataLocal;
  valorPagoCentavos: Centavos;
}

export interface FaturasRepository {
  pagamentos(): Promise<PagamentoDeFatura[]>;
  marcarComoPaga(pagamento: PagamentoDeFatura): Promise<void>;
  desmarcar(cartaoId: number, competencia: Competencia): Promise<void>;
}

export interface Receita {
  id: number;
  descricao: string;
  valorCentavos: Centavos;
  competencia: Competencia;
  competenciaFim: Competencia | null;
  recorrente: boolean;
}

export type ReceitasRepository = Omit<Cadastro<Receita>, 'possuiCompras'>;

export interface Preferencias {
  limiteRendaComprometida: number;
  backupAutomatico: boolean;
  ultimoBackup: string | null;
  modeloCobranca: string;
  chavePix: string;
  alertasDesligados: TipoDeAlerta[];
  alertasLidos: string[];
  alertasNotificados: string[];
  notificarNoWindows: boolean;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  limiteRendaComprometida: 30,
  backupAutomatico: true,
  ultimoBackup: null,
  modeloCobranca:
    'Oi, {nome}! Faltam {valor} das suas compras no meu {cartão}, que vence em {vencimento}. Meu Pix: {pix}',
  chavePix: '',
  alertasDesligados: [],
  alertasLidos: [],
  alertasNotificados: [],
  notificarNoWindows: true,
};

export interface PreferenciasRepository {
  ler(): Promise<Preferencias>;
  gravar(preferencias: Partial<Preferencias>): Promise<void>;
}

export interface AbatimentoGravado {
  compraId: number;
  numero: number;
  valor: Centavos;
}

export interface Movimento {
  id: number;
  terceiroId: number;
  tipo: 'deposito' | 'cobranca';
  valorCentavos: Centavos;
  data: DataLocal;
  competencia: Competencia;
  abatimentos: AbatimentoGravado[];
}

export type NovoDeposito = Omit<Movimento, 'id' | 'tipo'>;
export type NovaCobranca = Omit<Movimento, 'id' | 'tipo' | 'abatimentos'>;

export interface ReceberRepository {
  movimentos(): Promise<Movimento[]>;
  registrarDeposito(deposito: NovoDeposito): Promise<number>;
  registrarCobranca(cobranca: NovaCobranca): Promise<number>;
  excluir(id: number): Promise<void>;
  restaurar(id: number): Promise<void>;
}

export interface Repositorios {
  cartoes: CartoesRepository;
  categorias: Cadastro<Categoria>;
  terceiros: Cadastro<Terceiro>;
  compras: ComprasRepository;
  faturas: FaturasRepository;
  receitas: ReceitasRepository;
  preferencias: PreferenciasRepository;
  backup: ServicoDeBackup;
  receber: ReceberRepository;
}

export class RegistroNaoEncontrado extends Error {
  constructor(entidade: string, id: number) {
    super(`${entidade} ${id} não encontrado`);
    this.name = 'RegistroNaoEncontrado';
  }
}
