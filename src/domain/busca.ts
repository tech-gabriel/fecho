import type { DataLocal } from './competencia';
import { normalizar } from './importacao';
import type { Centavos } from './money';

export interface CompraBuscavel {
  id: number;
  descricao: string;
  dataCompra: DataLocal;
  valorTotal: Centavos;
}

const MINIMO = 2;

const emReais = (centavos: Centavos) =>
  `${String(Math.trunc(centavos / 100))},${String(centavos % 100).padStart(2, '0')}`;

function criterio(termo: string): (c: CompraBuscavel) => boolean {
  const data = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(termo);
  if (data) {
    const [, dia = '', mes = '', ano] = data;
    const alvo = `${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    return (c) => c.dataCompra.slice(5) === alvo && (!ano || c.dataCompra.startsWith(ano));
  }
  const valor = termo.replace(/r\$|\s|\./gi, '');
  const porValor = /^\d+(,\d{0,2})?$/.test(valor);
  const texto = normalizar(termo);
  return (c) =>
    normalizar(c.descricao).includes(texto) ||
    (porValor && emReais(c.valorTotal).startsWith(valor));
}

export function buscarCompras<C extends CompraBuscavel>(
  compras: readonly C[],
  termo: string,
  limite = 8,
): C[] {
  const limpo = termo.trim();
  if (limpo.length < MINIMO) return [];
  const casa = criterio(limpo);
  return compras
    .filter(casa)
    .sort((a, b) => b.dataCompra.localeCompare(a.dataCompra) || b.id - a.id)
    .slice(0, limite);
}
