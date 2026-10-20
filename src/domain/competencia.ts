export type Competencia = string;
export type DataLocal = string;

const formatoCompetencia = /^(\d{4})-(0[1-9]|1[0-2])$/;
const formatoData = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/;
const dois = (n: number) => String(n).padStart(2, '0');

function anoMes(c: Competencia): [number, number] {
  const m = formatoCompetencia.exec(c);
  if (!m) throw new RangeError(`Competência inválida: ${c}`);
  return [Number(m[1]), Number(m[2])];
}

export function assertCompetencia(c: string): Competencia {
  anoMes(c);
  return c;
}

export function ultimoDia(c: Competencia): number {
  const [ano, mes] = anoMes(c);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function assertDataLocal(d: string): DataLocal {
  const m = formatoData.exec(d);
  const dia = Number(m?.[3]);
  if (!m || dia < 1 || dia > ultimoDia(`${m[1]}-${m[2]}`)) {
    throw new RangeError(`Data inválida: ${d}`);
  }
  return d;
}

export function competenciaDe(d: DataLocal): Competencia {
  return assertDataLocal(d).slice(0, 7);
}

export function diaDe(d: DataLocal): number {
  return Number(assertDataLocal(d).slice(8));
}

export function somarMeses(c: Competencia, meses: number): Competencia {
  const [ano, mes] = anoMes(c);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${dois((total % 12) + 1)}`;
}

export function dataNaCompetencia(c: Competencia, dia: number): DataLocal {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new RangeError(`Dia inválido: ${dia}`);
  return `${c}-${dois(Math.min(dia, ultimoDia(c)))}`;
}

export function diasEntre(de: DataLocal, ate: DataLocal): number {
  const utc = (d: DataLocal) => {
    assertDataLocal(d);
    return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8)));
  };
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}
