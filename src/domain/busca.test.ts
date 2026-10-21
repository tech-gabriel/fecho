import { describe, expect, it } from 'vitest';
import { buscarCompras } from './busca';

const compras = [
  { id: 1, descricao: 'Jantar de aniversário', dataCompra: '2026-08-12', valorTotal: 8_990 },
  { id: 2, descricao: 'Geladeira', dataCompra: '2026-10-02', valorTotal: 123_456 },
  { id: 3, descricao: 'Padaria', dataCompra: '2026-10-12', valorTotal: 1_250 },
  { id: 4, descricao: 'JANTAR fora', dataCompra: '2026-09-30', valorTotal: 4_000 },
] as const;

const ids = (termo: string, limite?: number) =>
  buscarCompras(compras, termo, limite).map((c) => c.id);

describe('buscarCompras', () => {
  it('só busca a partir de 2 caracteres', () => {
    expect(ids('')).toEqual([]);
    expect(ids(' j ')).toEqual([]);
  });

  it('acha pela descrição sem acento e sem diferenciar maiúsculas, mais recentes primeiro', () => {
    expect(ids('jantar')).toEqual([4, 1]);
    expect(ids('aniversario')).toEqual([1]);
  });

  it('acha pelo valor em reais', () => {
    expect(ids('89,90')).toEqual([1]);
    expect(ids('R$ 1.234,56')).toEqual([2]);
    expect(ids('1234,56')).toEqual([2]);
    expect(ids('12,5')).toEqual([3]);
  });

  it('acha pela data com ou sem ano', () => {
    expect(ids('12/10')).toEqual([3]);
    expect(ids('12/08/2026')).toEqual([1]);
    expect(ids('30/09/2025')).toEqual([]);
  });

  it('corta no limite', () => {
    expect(ids('a', 8)).toEqual([]);
    expect(ids('ar', 1)).toEqual([3]);
  });
});
