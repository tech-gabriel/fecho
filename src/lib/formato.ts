import type { Competencia } from '@/domain/competencia';
import type { Centavos } from '@/domain/money';

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

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 });

export function formatarMoeda(centavos: Centavos): string {
  return moeda.format(centavos / 100);
}

export function formatarComSinal(centavos: Centavos): string {
  return formatarMoeda(centavos).replace('-', '−');
}

export function formatarDecimal(centavos: Centavos): string {
  return decimal.format(centavos / 100);
}

const dois = (n: number) => String(n).padStart(2, '0');

export function quandoFoi(momento: Date, agora: Date): string {
  const hora = `${dois(momento.getHours())}:${dois(momento.getMinutes())}`;
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diferenca = Math.round((dia(agora) - dia(momento)) / 86_400_000);
  if (diferenca === 0) return `hoje às ${hora}`;
  if (diferenca === 1) return `ontem às ${hora}`;
  return `${dois(momento.getDate())}/${dois(momento.getMonth() + 1)}/${momento.getFullYear()} às ${hora}`;
}

const diaEMes = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export function diaPorExtenso(data: string): string {
  return diaEMes.format(new Date(`${data}T00:00:00Z`));
}
