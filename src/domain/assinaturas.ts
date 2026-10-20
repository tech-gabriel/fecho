import {
  type Competencia,
  type DataLocal,
  competenciaDe,
  dataNaCompetencia,
  somarMeses,
} from './competencia';
import type { DadosNovaCompra } from './compras';
import { competenciaDaCompra } from './faturas';
import { type Centavos, somar } from './money';
import { type Rateio, ratear } from './terceiros';

export interface Assinatura {
  id: number;
  nome: string;
  cartaoId: number;
  categoriaId: number | null;
  valorCentavos: Centavos;
  dia: number;
  rateios: Rateio[];
  ativa: boolean;
  inicio: Competencia;
}

export interface Cobranca {
  assinatura: Assinatura;
  mes: Competencia;
  dataCompra: DataLocal;
}

export const chaveDaCobranca = (assinaturaId: number, mes: Competencia) =>
  `${String(assinaturaId)}:${mes}`;

export function cobrancasAGerar(
  assinaturas: readonly Assinatura[],
  geradas: ReadonlySet<string>,
  hoje: DataLocal,
): { doMes: Cobranca[]; atrasadas: Cobranca[] } {
  const atual = competenciaDe(hoje);
  const doMes: Cobranca[] = [];
  const atrasadas: Cobranca[] = [];
  for (const assinatura of assinaturas) {
    if (!assinatura.ativa) continue;
    for (let mes = assinatura.inicio; mes <= atual; mes = somarMeses(mes, 1)) {
      if (geradas.has(chaveDaCobranca(assinatura.id, mes))) continue;
      const cobranca = { assinatura, mes, dataCompra: dataNaCompetencia(mes, assinatura.dia) };
      (mes === atual ? doMes : atrasadas).push(cobranca);
    }
  }
  return { doMes, atrasadas };
}

export function proximaCobranca(assinatura: Assinatura, hoje: DataLocal): DataLocal {
  const atual = competenciaDe(hoje);
  const mes = assinatura.inicio > atual ? assinatura.inicio : atual;
  const data = dataNaCompetencia(mes, assinatura.dia);
  return data >= hoje ? data : dataNaCompetencia(somarMeses(mes, 1), assinatura.dia);
}

export function resumoDasAssinaturas(
  assinaturas: readonly Assinatura[],
  rendaDoMes: Centavos,
): { porMes: Centavos; porAno: Centavos; ativas: number; percentualDaRenda: number | null } {
  const ativas = assinaturas.filter((a) => a.ativa);
  const porMes = somar(ativas.map((a) => a.valorCentavos));
  return {
    porMes,
    porAno: porMes * 12,
    ativas: ativas.length,
    percentualDaRenda: rendaDoMes > 0 ? Math.round((porMes / rendaDoMes) * 1000) / 10 : null,
  };
}

export function projecaoDeAssinaturas(
  assinaturas: readonly Assinatura[],
  competencia: Competencia,
  geradas: ReadonlySet<string>,
  cartoes: readonly { id: number; diaFechamento: number }[],
): Centavos {
  return somar(
    assinaturas.flatMap((a) => {
      const cartao = cartoes.find((c) => c.id === a.cartaoId);
      if (!a.ativa || !cartao) return [];
      const meu = ratear(a.valorCentavos, a.rateios).meu;
      // a cobrança do mês X cai na fatura de X ou de X+1, conforme o fechamento
      return [somarMeses(competencia, -1), competencia]
        .filter(
          (mes) =>
            mes >= a.inicio &&
            !geradas.has(chaveDaCobranca(a.id, mes)) &&
            competenciaDaCompra(dataNaCompetencia(mes, a.dia), cartao.diaFechamento) ===
              competencia,
        )
        .map(() => meu);
    }),
  );
}

export function compraDaCobranca({ assinatura, mes, dataCompra }: Cobranca): DadosNovaCompra {
  return {
    cartaoId: assinatura.cartaoId,
    descricao: assinatura.nome,
    categoriaId: assinatura.categoriaId,
    valorTotal: assinatura.valorCentavos,
    numParcelas: 1,
    dataCompra,
    recorrente: true,
    rateios: assinatura.rateios,
    assinatura: { id: assinatura.id, mes },
  };
}
