import { describe, expect, it } from 'vitest';
import { reconciliar, type LinhaDoFecho } from './reconciliacao';

const fecho = (id: string, data: string, descricao: string, valor: number, aVista = true) =>
  ({ id, compraId: Number(id), data, descricao, valor, aVista }) satisfies LinhaDoFecho;
const banco = (data: string, descricao: string, valor: number) => ({ data, descricao, valor });

describe('reconciliar', () => {
  it('casa valores iguais com até 3 dias de diferença na data', () => {
    const r = reconciliar(
      [
        fecho('1', '2026-10-12', 'Supermercado', 48_730),
        fecho('2', '2026-10-18', 'Jantar', 32_000),
      ],
      [
        banco('2026-10-13', 'SUPERMERCADO PAO DE ACUCAR', 48_730),
        banco('2026-10-21', 'RESTAURANTE', 32_000),
      ],
    );
    expect(r.iguais.map((p) => p.fecho.id)).toEqual(['1', '2']);
    expect(r).toMatchObject({
      diferentes: [],
      soNoBanco: [],
      soNoFecho: [],
      totalFecho: 80_730,
      totalBanco: 80_730,
    });
  });

  it('não usa a mesma linha duas vezes e escolhe a data mais próxima', () => {
    const r = reconciliar(
      [fecho('1', '2026-10-10', 'Uber', 2_000), fecho('2', '2026-10-12', 'Uber', 2_000)],
      [banco('2026-10-12', 'UBER TRIP', 2_000), banco('2026-10-10', 'UBER TRIP', 2_000)],
    );
    expect(r.iguais.map((p) => [p.fecho.id, p.banco.data])).toEqual([
      ['1', '2026-10-10'],
      ['2', '2026-10-12'],
    ]);
  });

  it('acha o valor diferente pela descrição e data próximas', () => {
    const r = reconciliar(
      [fecho('1', '2026-10-05', 'Streaming', 5_590)],
      [banco('2026-10-05', 'STREAMING*PREMIUM', 5_990)],
    );
    expect(r.iguais).toEqual([]);
    expect(r.diferentes.map((p) => [p.fecho.id, p.banco.valor])).toEqual([['1', 5_990]]);
  });

  it('separa o que só está num dos lados e ignora pagamentos do extrato', () => {
    const r = reconciliar(
      [fecho('1', '2026-10-02', 'Tênis', 21_650, false)],
      [
        banco('2026-10-25', 'IOF COMPRA INTERNACIONAL', 380),
        banco('2026-10-06', 'PAGAMENTO RECEBIDO', -150_000),
      ],
    );
    expect(r.soNoFecho.map((l) => l.id)).toEqual(['1']);
    expect(r.soNoBanco.map((l) => l.descricao)).toEqual(['IOF COMPRA INTERNACIONAL']);
    expect(r.totalBanco).toBe(380);
  });

  it('não casa valores iguais com mais de 3 dias de diferença', () => {
    const r = reconciliar(
      [fecho('1', '2026-10-01', 'Farmácia', 8_420)],
      [banco('2026-10-05', 'DROGARIA', 8_420)],
    );
    expect(r.iguais).toEqual([]);
    expect(r.soNoFecho).toHaveLength(1);
    expect(r.soNoBanco).toHaveLength(1);
  });

  it('acha o valor diferente por qualquer palavra em comum na descrição', () => {
    const r = reconciliar(
      [fecho('1', '2026-10-18', 'Jantar de aniversário', 32_000)],
      [banco('2026-10-18', 'RESTAURANTE JANTAR', 33_000)],
    );
    expect(r.diferentes.map((p) => p.banco.valor)).toEqual([33_000]);
  });
});
