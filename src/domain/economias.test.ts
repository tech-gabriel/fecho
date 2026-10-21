import { describe, expect, it } from 'vitest';
import {
  guardadoNoMes,
  historicoDeEconomia,
  metaDoMes,
  progressoDoObjetivo,
  type MovimentoDeEconomia,
} from './economias';

const metas = [
  { valorCentavos: 100_000, inicio: '2026-12' },
  { valorCentavos: 80_000, inicio: '2026-01' },
];
let proximo = 1;
const mov = (data: string, valorCentavos: number, objetivoId: number | null = null) =>
  ({ id: proximo++, data, valorCentavos, objetivoId }) satisfies MovimentoDeEconomia;

describe('metaDoMes', () => {
  it('usa a meta mais recente que já começou', () => {
    expect(metaDoMes(metas, '2025-12')).toBeNull();
    expect(metaDoMes(metas, '2026-01')).toBe(80_000);
    expect(metaDoMes(metas, '2026-11')).toBe(80_000);
    expect(metaDoMes(metas, '2027-03')).toBe(100_000);
  });
});

describe('guardadoNoMes', () => {
  it('soma o que entrou e desconta o que saiu no mês', () => {
    const movimentos = [
      mov('2026-10-05', 50_000),
      mov('2026-10-20', -10_000),
      mov('2026-11-01', 30_000),
    ];
    expect(guardadoNoMes(movimentos, '2026-10')).toBe(40_000);
    expect(guardadoNoMes(movimentos, '2026-09')).toBe(0);
  });
});

describe('historicoDeEconomia', () => {
  it('monta os meses até o escolhido, virando o ano, e marca quem bateu a meta', () => {
    const historico = historicoDeEconomia(
      [mov('2025-12-10', 90_000), mov('2026-01-10', 80_000), mov('2026-02-10', 79_999)],
      metas,
      '2026-02',
      3,
    );
    expect(historico).toEqual([
      { competencia: '2025-12', guardado: 90_000, meta: null, bateu: false },
      { competencia: '2026-01', guardado: 80_000, meta: 80_000, bateu: true },
      { competencia: '2026-02', guardado: 79_999, meta: 80_000, bateu: false },
    ]);
  });

  it('usa 12 meses por padrão', () => {
    expect(historicoDeEconomia([], metas, '2026-10')).toHaveLength(12);
  });
});

describe('progressoDoObjetivo', () => {
  const viagem = { id: 7, nome: 'Viagem', alvoCentavos: 800_000, prazo: '2027-07' };

  it('soma só o que foi para o objetivo e divide o que falta até o prazo', () => {
    const movimentos = [
      mov('2026-09-01', 300_000, 7),
      mov('2026-10-01', 15_000, 7),
      mov('2026-10-02', 99_999),
    ];
    expect(progressoDoObjetivo(viagem, movimentos, '2026-10-20')).toEqual({
      guardado: 315_000,
      percentual: 39,
      falta: 485_000,
      porMes: 48_500,
      concluido: false,
    });
  });

  it('arredonda o valor por mês para cima', () => {
    expect(
      progressoDoObjetivo(
        { ...viagem, prazo: '2026-12' },
        [mov('2026-10-01', 799_999, 7)],
        '2026-10-20',
      ).porMes,
    ).toBe(1);
    expect(
      progressoDoObjetivo({ ...viagem, alvoCentavos: 1_000, prazo: '2026-12' }, [], '2026-10-20')
        .porMes,
    ).toBe(334);
  });

  it('com prazo vencido pede tudo agora e sem prazo não calcula por mês', () => {
    expect(progressoDoObjetivo({ ...viagem, prazo: '2026-09' }, [], '2026-10-20').porMes).toBe(
      800_000,
    );
    expect(progressoDoObjetivo({ ...viagem, prazo: null }, [], '2026-10-20').porMes).toBeNull();
  });

  it('para em 100% e fica concluído quando passa do alvo', () => {
    expect(
      progressoDoObjetivo(viagem, [mov('2026-10-01', 900_000, 7)], '2026-10-20'),
    ).toMatchObject({
      percentual: 100,
      falta: 0,
      porMes: null,
      concluido: true,
    });
  });
});
