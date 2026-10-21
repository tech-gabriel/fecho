import type { Competencia, DataLocal } from '@/domain/competencia';
import type { DadosNovaCompra } from '@/domain/compras';
import type { Parcela } from '@/domain/parcelas';
import type { ServicoDeBackup } from '../backup';
import type { ServicoDeSeguranca } from '../seguranca';
import type { CompraParaRecalculo, MudancaDeFatura } from '@/domain/faturas';
import type { Centavos } from '@/domain/money';
import type { Rateio } from '@/domain/terceiros';
import type { TipoDeAlerta } from '@/domain/alertas';
import type { Assinatura } from '@/domain/assinaturas';
import type {
  EmprestimoConcedido,
  EmprestimoTomado,
  PagamentoDeParcela,
} from '@/domain/emprestimos';
import type { Abatimento } from '@/domain/receber';
import type { MetaDeEconomia, MovimentoDeEconomia, Objetivo } from '@/domain/economias';

export type {
  Assinatura,
  EmprestimoConcedido,
  EmprestimoTomado,
  MetaDeEconomia,
  MovimentoDeEconomia,
  Objetivo,
  PagamentoDeParcela,
};

export interface Conferencia {
  cartaoId: number;
  competencia: Competencia;
  extrato: string | null;
  conferidaEm: DataLocal;
}

export interface FechamentoRepository {
  fechados(): Promise<Competencia[]>;
  fechar(competencia: Competencia, em: DataLocal): Promise<void>;
  reabrir(competencia: Competencia): Promise<void>;
  conferencias(): Promise<Conferencia[]>;
  conferir(conferencia: Conferencia): Promise<void>;
  desconferir(cartaoId: number, competencia: Competencia): Promise<void>;
}

export interface EconomiasRepository {
  metas: {
    listar(): Promise<MetaDeEconomia[]>;
    definir(meta: MetaDeEconomia): Promise<void>;
  };
  objetivos: Omit<Cadastro<Objetivo>, 'possuiCompras'>;
  movimentos: Omit<Cadastro<MovimentoDeEconomia>, 'possuiCompras' | 'atualizar'>;
}

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
  etapaDoFechamento: { competencia: Competencia; etapa: number } | null;
  bloquearAposMinutos: number | null;
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
  etapaDoFechamento: null,
  bloquearAposMinutos: 5,
};

export interface PreferenciasRepository {
  ler(): Promise<Preferencias>;
  gravar(preferencias: Partial<Preferencias>): Promise<void>;
}

export type AbatimentoGravado = Abatimento;

export interface EmprestimosRepository {
  tomados: Omit<Cadastro<EmprestimoTomado>, 'possuiCompras'>;
  concedidos: Omit<Cadastro<EmprestimoConcedido>, 'possuiCompras'>;
  pagamentos(): Promise<PagamentoDeParcela[]>;
  marcarPaga(pagamento: PagamentoDeParcela): Promise<void>;
  desmarcar(emprestimoId: number, numero: number): Promise<void>;
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

export interface AssinaturasRepository extends Cadastro<Assinatura> {
  geradas(): Promise<string[]>;
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
  seguranca: ServicoDeSeguranca;
  receber: ReceberRepository;
  assinaturas: AssinaturasRepository;
  emprestimos: EmprestimosRepository;
  economias: EconomiasRepository;
  fechamento: FechamentoRepository;
}

export class MesFechado extends Error {
  constructor(readonly competencia: Competencia) {
    super(`O mês ${competencia} está fechado`);
  }
}

export class RegistroNaoEncontrado extends Error {
  constructor(entidade: string, id: number) {
    super(`${entidade} ${id} não encontrado`);
    this.name = 'RegistroNaoEncontrado';
  }
}
