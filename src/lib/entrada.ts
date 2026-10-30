import type { InputEvent } from 'react';

function separar(texto: string, permitido: RegExp, casas: number) {
  const limpo = texto.replace(permitido, '');
  const virgula = limpo.indexOf(',');
  if (virgula === -1) return limpo;
  const decimais = limpo
    .slice(virgula + 1)
    .replace(/,/g, '')
    .slice(0, casas);
  return `${limpo.slice(0, virgula)},${decimais}`;
}

export const soDinheiro = (texto: string) => separar(texto, /[^\d.,]/g, 2);

export const soDecimal = (texto: string) => separar(texto.replace(/\./g, ','), /[^\d,]/g, 2);

export const soDigitos = (maximo: number) => (texto: string) =>
  texto.replace(/\D/g, '').slice(0, maximo);

// roda antes do onChange do React (os dois vêm do mesmo evento input), então o formulário já lê o valor limpo
function aoDigitar(filtro: (texto: string) => string) {
  return (e: InputEvent<HTMLInputElement>) => {
    const campo = e.currentTarget;
    const antes = campo.value;
    const depois = filtro(antes);
    if (depois === antes) return;
    const cursor = Math.max(
      (campo.selectionStart ?? antes.length) - (antes.length - depois.length),
      0,
    );
    campo.value = depois;
    campo.setSelectionRange(cursor, cursor);
  };
}

export const entradaDeDinheiro = {
  inputMode: 'decimal',
  maxLength: 16,
  onInput: aoDigitar(soDinheiro),
} as const;

export const entradaDeTaxa = {
  inputMode: 'decimal',
  maxLength: 6,
  onInput: aoDigitar(soDecimal),
} as const;

export const entradaDeInteiro = (maximo: number) =>
  ({ inputMode: 'numeric', maxLength: maximo, onInput: aoDigitar(soDigitos(maximo)) }) as const;
