import { type Assinatura, proximaCobranca } from './assinaturas';
import {
  type Competencia,
  type DataLocal,
  competenciaDe,
  dataNaCompetencia,
  diasEntre,
  somarMeses,
} from './competencia';
import { competenciaDaCompra, datasDaFatura, type DiasDoCartao } from './faturas';
import type { Centavos } from './money';
import { DIAS_DE_ANTECEDENCIA_DO_ALERTA, precisaAlertarReembolso } from './terceiros';

export type TipoDeAlerta =
  | 'reembolso'
  | 'fechamento'
  | 'vencimento'
  | 'atraso'
  | 'assinatura'
  | 'devolucao'
  | 'parcela-emprestimo'
  | 'fechar-mes';

export interface EmprestimosParaAlerta {
  devolucoes: readonly {
    emprestimoId: number;
    terceiroId: number;
    prazo: DataLocal;
    falta: Centavos;
  }[];
  parcelas: readonly {
    emprestimoId: number;
    numero: number;
    vencimento: DataLocal;
    valor: Centavos;
    paga: boolean;
  }[];
}

export const DIAS_ANTES_DO_FECHAMENTO = 3;
export const DIAS_ANTES_DO_VENCIMENTO = 3;
export const DIAS_DE_ATRASO_ALERTADOS = 30;
export const DIAS_ANTES_DE_FECHAR_O_MES = 3;
export const DIAS_PARA_LEMBRAR_O_MES_ANTERIOR = 10;

export interface FaturaParaAlerta {
  cartaoId: number;
  competencia: Competencia;
  vencimento: DataLocal;
  total: Centavos;
  paga: boolean;
  faltaPorTerceiro: { terceiroId: number; falta: Centavos }[];
}

export interface Alerta {
  chave: string;
  tipo: TipoDeAlerta;
  cartaoId: number;
  competencia: Competencia;
  terceiroId?: number;
  assinaturaId?: number;
  emprestimoId?: number;
  numero?: number;
  valor?: Centavos;
  data: DataLocal;
  dias: number;
  idade: number;
}

export function alertasDoDia(
  faturas: readonly FaturaParaAlerta[],
  cartoes: readonly ({ id: number } & DiasDoCartao)[],
  hoje: DataLocal,
  desligados: readonly TipoDeAlerta[] = [],
  assinaturas: readonly Assinatura[] = [],
  emprestimos: EmprestimosParaAlerta = { devolucoes: [], parcelas: [] },
  fechados?: ReadonlySet<Competencia>,
): Alerta[] {
  const alertas: Alerta[] = [];

  for (const cartao of cartoes) {
    const competencia = competenciaDaCompra(hoje, cartao.diaFechamento);
    const { fechamento } = datasDaFatura(competencia, cartao);
    const dias = diasEntre(hoje, fechamento);
    if (dias >= 1 && dias <= DIAS_ANTES_DO_FECHAMENTO) {
      alertas.push({
        chave: `fechamento:${String(cartao.id)}:${competencia}`,
        tipo: 'fechamento',
        cartaoId: cartao.id,
        competencia,
        data: fechamento,
        dias,
        idade: DIAS_ANTES_DO_FECHAMENTO - dias,
      });
    }
  }

  for (const fatura of faturas) {
    if (fatura.paga) continue;
    const { cartaoId, competencia, vencimento } = fatura;
    const dias = diasEntre(hoje, vencimento);
    if (dias < -DIAS_DE_ATRASO_ALERTADOS) continue;
    const base = { cartaoId, competencia, data: vencimento, dias };
    const sufixo = `${String(cartaoId)}:${competencia}`;

    if (fatura.total > 0 && dias < 0) {
      alertas.push({ ...base, chave: `atraso:${sufixo}`, tipo: 'atraso', idade: -dias - 1 });
    } else if (fatura.total > 0 && dias <= DIAS_ANTES_DO_VENCIMENTO) {
      alertas.push({
        ...base,
        chave: `vencimento:${sufixo}`,
        tipo: 'vencimento',
        idade: DIAS_ANTES_DO_VENCIMENTO - dias,
      });
    }

    for (const { terceiroId, falta } of fatura.faltaPorTerceiro) {
      if (!precisaAlertarReembolso({ hoje, vencimento, faltando: falta })) continue;
      alertas.push({
        ...base,
        chave: `reembolso:${sufixo}:${String(terceiroId)}`,
        tipo: 'reembolso',
        terceiroId,
        valor: falta,
        idade: DIAS_DE_ANTECEDENCIA_DO_ALERTA - dias,
      });
    }
  }

  for (const assinatura of assinaturas) {
    if (!assinatura.ativa) continue;
    const data = proximaCobranca(assinatura, hoje);
    if (diasEntre(hoje, data) !== 1) continue;
    const competencia = competenciaDe(data);
    alertas.push({
      chave: `assinatura:${String(assinatura.id)}:${competencia}`,
      tipo: 'assinatura',
      cartaoId: assinatura.cartaoId,
      competencia,
      assinaturaId: assinatura.id,
      valor: assinatura.valorCentavos,
      data,
      dias: 1,
      idade: 0,
    });
  }

  for (const { emprestimoId, terceiroId, prazo, falta } of emprestimos.devolucoes) {
    const dias = diasEntre(hoje, prazo);
    if (falta <= 0 || dias >= 0 || dias < -DIAS_DE_ATRASO_ALERTADOS) continue;
    alertas.push({
      chave: `devolucao:${String(emprestimoId)}`,
      tipo: 'devolucao',
      cartaoId: 0,
      competencia: competenciaDe(prazo),
      emprestimoId,
      terceiroId,
      valor: falta,
      data: prazo,
      dias,
      idade: -dias - 1,
    });
  }

  for (const { emprestimoId, numero, vencimento, valor, paga } of emprestimos.parcelas) {
    const dias = diasEntre(hoje, vencimento);
    if (paga || dias > 0 || dias < -DIAS_DE_ATRASO_ALERTADOS) continue;
    alertas.push({
      chave: `parcela-emprestimo:${String(emprestimoId)}:${String(numero)}`,
      tipo: 'parcela-emprestimo',
      cartaoId: 0,
      competencia: competenciaDe(vencimento),
      emprestimoId,
      numero,
      valor,
      data: vencimento,
      dias,
      idade: Math.abs(dias),
    });
  }

  const mesAtual = competenciaDe(hoje);
  const anterior = somarMeses(mesAtual, -1);
  const fimDoMes = dataNaCompetencia(mesAtual, 31);
  const diasParaFechar = diasEntre(hoje, fimDoMes);
  const lembrar = (competencia: Competencia, dias: number, idade: number) => {
    alertas.push({
      chave: `fechar-mes:${competencia}`,
      tipo: 'fechar-mes',
      cartaoId: 0,
      competencia,
      data: dataNaCompetencia(competencia, 31),
      dias,
      idade,
    });
  };
  if (fechados && diasParaFechar <= DIAS_ANTES_DE_FECHAR_O_MES && !fechados.has(mesAtual)) {
    lembrar(mesAtual, diasParaFechar, DIAS_ANTES_DE_FECHAR_O_MES - diasParaFechar);
  }
  const diasDepois = diasEntre(dataNaCompetencia(anterior, 31), hoje);
  if (fechados && diasDepois <= DIAS_PARA_LEMBRAR_O_MES_ANTERIOR && !fechados.has(anterior)) {
    lembrar(anterior, -diasDepois, diasDepois - 1);
  }

  return alertas.filter((a) => !desligados.includes(a.tipo)).sort((a, b) => a.idade - b.idade);
}

export type GrupoDeAlerta = 'Hoje' | 'Esta semana' | 'Antes';

export function grupoDoAlerta(idade: number): GrupoDeAlerta {
  if (idade <= 0) return 'Hoje';
  return idade < 7 ? 'Esta semana' : 'Antes';
}
