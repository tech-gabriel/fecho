import { type Assinatura, proximaCobranca } from './assinaturas';
import { type Competencia, type DataLocal, competenciaDe, diasEntre } from './competencia';
import { competenciaDaCompra, datasDaFatura, type DiasDoCartao } from './faturas';
import type { Centavos } from './money';
import { DIAS_DE_ANTECEDENCIA_DO_ALERTA, precisaAlertarReembolso } from './terceiros';

export type TipoDeAlerta = 'reembolso' | 'fechamento' | 'vencimento' | 'atraso' | 'assinatura';

export const DIAS_ANTES_DO_FECHAMENTO = 3;
export const DIAS_ANTES_DO_VENCIMENTO = 3;
export const DIAS_DE_ATRASO_ALERTADOS = 30;

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

  return alertas.filter((a) => !desligados.includes(a.tipo)).sort((a, b) => a.idade - b.idade);
}

export type GrupoDeAlerta = 'Hoje' | 'Esta semana' | 'Antes';

export function grupoDoAlerta(idade: number): GrupoDeAlerta {
  if (idade <= 0) return 'Hoje';
  return idade < 7 ? 'Esta semana' : 'Antes';
}
