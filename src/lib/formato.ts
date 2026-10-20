import type { Competencia } from '@/domain/competencia';

const mesLongo = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
const mesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

function dataDoMes(c: Competencia) {
  return new Date(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1, 1);
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function nomeDoMes(c: Competencia): string {
  return `${maiuscula(mesLongo.format(dataDoMes(c)))} ${c.slice(0, 4)}`;
}

export function mesAbreviado(c: Competencia): { mes: string; ano: string } {
  return { mes: maiuscula(mesCurto.format(dataDoMes(c)).replace('.', '')), ano: c.slice(2, 4) };
}
