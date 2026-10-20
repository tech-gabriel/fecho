import { describe, expect, it } from 'vitest';
import { contratoDosRepositorios } from '../contrato.suite';
import { criarRepositoriosEmMemoria } from '.';
import { semearDadosFicticios } from './dados-ficticios';

contratoDosRepositorios('memória', () => Promise.resolve(criarRepositoriosEmMemoria()));

describe('dados fictícios', () => {
  it('populam cartões, pessoas e compras de Outubro 2026', async () => {
    const repos = criarRepositoriosEmMemoria();
    await semearDadosFicticios(repos);

    expect((await repos.cartoes.listar()).map((c) => c.nome)).toContain('Cartão Roxo');
    expect((await repos.terceiros.listar()).map((t) => t.nome)).toEqual([
      'Ana',
      'Bruno',
      'Carla',
      'Daniel',
    ]);
    const outubro = await repos.compras.parcelasDaCompetencia('2026-10');
    expect(outubro.some((p) => p.rateios.length > 0)).toBe(true);
  });
});
