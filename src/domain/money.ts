export type Centavos = number;

export function assertCentavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor)) throw new RangeError(`Valor em centavos inválido: ${valor}`);
  return valor;
}

export function somar(valores: readonly Centavos[]): Centavos {
  return valores.reduce((total, valor) => total + assertCentavos(valor), 0);
}

export function dividirComResto(total: Centavos, partes: number): Centavos[] {
  assertCentavos(total);
  if (!Number.isInteger(partes) || partes < 1) {
    throw new RangeError(`Número de partes inválido: ${partes}`);
  }
  const base = Math.trunc(total / partes);
  const resto = total - base * partes;
  return Array.from({ length: partes }, (_, i) => (i === 0 ? base + resto : base));
}

const formatoReais = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export function lerReais(texto: string): Centavos {
  const m = formatoReais.exec(texto.trim());
  if (!m?.[1]) throw new RangeError('Digite um valor como 1.234,56');
  const reais = Number(m[1].replaceAll('.', ''));
  const centavos = Number((m[2] ?? '').padEnd(2, '0'));
  return assertCentavos(reais * 100 + centavos);
}
