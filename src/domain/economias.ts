import { type Competencia, type DataLocal, competenciaDe, somarMeses } from './competencia';
import { type Centavos, somar } from './money';

export interface MetaDeEconomia {
  valorCentavos: Centavos;
  inicio: Competencia;
}

export interface MovimentoDeEconomia {
  id: number;
  data: DataLocal;
  valorCentavos: Centavos;
  objetivoId: number | null;
}

export interface Objetivo {
  id: number;
  nome: string;
  alvoCentavos: Centavos;
  prazo: Competencia | null;
}

export function metaDoMes(
  metas: readonly MetaDeEconomia[],
  competencia: Competencia,
): Centavos | null {
  const vigentes = metas.filter((m) => m.inicio <= competencia);
  if (vigentes.length === 0) return null;
  return vigentes.reduce((a, b) => (b.inicio > a.inicio ? b : a)).valorCentavos;
}

export function guardadoNoMes(
  movimentos: readonly MovimentoDeEconomia[],
  competencia: Competencia,
): Centavos {
  return somar(
    movimentos.filter((m) => competenciaDe(m.data) === competencia).map((m) => m.valorCentavos),
  );
}

export function historicoDeEconomia(
  movimentos: readonly MovimentoDeEconomia[],
  metas: readonly MetaDeEconomia[],
  ate: Competencia,
  meses = 12,
) {
  return Array.from({ length: meses }, (_, i) => {
    const competencia = somarMeses(ate, i - meses + 1);
    const guardado = guardadoNoMes(movimentos, competencia);
    const meta = metaDoMes(metas, competencia);
    return { competencia, guardado, meta, bateu: meta !== null && guardado >= meta };
  });
}

function mesesAte(de: Competencia, ate: Competencia): number {
  const total = (c: Competencia) => Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7));
  return total(ate) - total(de) + 1;
}

export function progressoDoObjetivo(
  objetivo: Objetivo,
  movimentos: readonly MovimentoDeEconomia[],
  hoje: DataLocal,
) {
  const guardado = somar(
    movimentos.filter((m) => m.objetivoId === objetivo.id).map((m) => m.valorCentavos),
  );
  const falta = Math.max(objetivo.alvoCentavos - guardado, 0);
  const concluido = falta === 0;
  const meses = objetivo.prazo ? mesesAte(competenciaDe(hoje), objetivo.prazo) : null;
  return {
    guardado,
    percentual: Math.min(100, Math.max(0, Math.floor((guardado / objetivo.alvoCentavos) * 100))),
    falta,
    porMes: concluido || meses === null ? null : meses <= 0 ? falta : Math.ceil(falta / meses),
    concluido,
  };
}
