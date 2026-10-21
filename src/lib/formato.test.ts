import { describe, expect, it } from 'vitest';
import { diaPorExtenso, formatarComSinal, quandoFoi } from './formato';

describe('quandoFoi', () => {
  const agora = new Date(2026, 9, 20, 14, 0);

  it.each([
    [new Date(2026, 9, 20, 8, 12), 'hoje às 08:12'],
    [new Date(2026, 9, 19, 23, 5), 'ontem às 23:05'],
    [new Date(2026, 8, 3, 7, 0), '03/09/2026 às 07:00'],
  ])('%s → %s', (momento, texto) => {
    expect(quandoFoi(momento, agora)).toBe(texto);
  });
});

describe('formatarComSinal', () => {
  it('usa o sinal de menos tipográfico nos negativos', () => {
    const semNbsp = (texto: string) => texto.replace(/\u00a0/g, ' ');
    expect(semNbsp(formatarComSinal(-107_555))).toBe('−R$ 1.075,55');
    expect(semNbsp(formatarComSinal(100))).toBe('R$ 1,00');
  });
});

describe('diaPorExtenso', () => {
  it('escreve o dia e o mês sem trocar o dia por fuso', () => {
    expect(diaPorExtenso('2026-10-28')).toBe('28 de outubro');
    expect(diaPorExtenso('2027-01-01')).toBe('1 de janeiro');
  });
});
