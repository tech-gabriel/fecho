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
