import { describe, expect, it } from 'vitest';
import {
  itemDoConcedido,
  parcelasDoTomado,
  parcelasTomadasDoMes,
  resumoDoTomado,
  type EmprestimoTomado,
} from './emprestimos';

const pessoal: EmprestimoTomado = {
  id: 1,
  descricao: 'Empréstimo pessoal',
  valorCentavos: 490_000,
  numParcelas: 12,
  valorParcelaCentavos: 48_000,
  dia: 10,
  inicio: '2026-05',
  data: '2026-04-10',
};
const pagas = (ate: number) =>
  Array.from({ length: ate }, (_, i) => ({ emprestimoId: 1, numero: i + 1, pagoEm: '2026-01-01' }));

describe('parcelasDoTomado', () => {
  it('gera uma parcela por mês a partir do início, no dia do débito', () => {
    const parcelas = parcelasDoTomado(pessoal, [], '2026-04-20');
    expect(parcelas).toHaveLength(12);
    expect(parcelas[0]).toEqual({
      numero: 1,
      competencia: '2026-05',
      vencimento: '2026-05-10',
      valor: 48_000,
      status: 'prevista',
      pagoEm: null,
    });
    expect(parcelas.at(-1)).toMatchObject({ numero: 12, competencia: '2027-04' });
  });

  it('usa o último dia do mês quando o dia do débito não existe nele', () => {
    const parcelas = parcelasDoTomado({ ...pessoal, dia: 31, inicio: '2027-02' }, [], '2026-10-20');
    expect(parcelas[0]?.vencimento).toBe('2027-02-28');
  });

  it('só fica paga quando marcada; vencida sem marca é atrasada', () => {
    const parcelas = parcelasDoTomado(pessoal, pagas(5), '2026-10-20');
    expect(parcelas.slice(0, 7).map((p) => p.status)).toEqual([
      'paga',
      'paga',
      'paga',
      'paga',
      'paga',
      'atrasada',
      'prevista',
    ]);
  });

  it('a do mês de hoje ainda no prazo é pendente, inclusive no dia', () => {
    expect(parcelasDoTomado(pessoal, pagas(5), '2026-10-10')[5]?.status).toBe('pendente');
  });
});

describe('resumoDoTomado', () => {
  it('soma o que falta, o total e os juros', () => {
    const parcelas = parcelasDoTomado(pessoal, pagas(6), '2026-10-20');
    expect(resumoDoTomado(pessoal, parcelas)).toEqual({
      pegou: 490_000,
      totalAPagar: 576_000,
      juros: 86_000,
      faltaPagar: 288_000,
      pagas: 6,
      proxima: parcelas[6],
      quitado: false,
    });
  });

  it('fica quitado com todas pagas', () => {
    const resumo = resumoDoTomado(pessoal, parcelasDoTomado(pessoal, pagas(12), '2027-06-01'));
    expect(resumo).toMatchObject({ faltaPagar: 0, proxima: null, quitado: true });
  });
});

describe('parcelasTomadasDoMes', () => {
  it('soma as parcelas que caem no mês, pagas ou não', () => {
    const outro = {
      ...pessoal,
      id: 2,
      valorParcelaCentavos: 10_000,
      numParcelas: 2,
      inicio: '2026-10',
    };
    expect(parcelasTomadasDoMes([pessoal, outro], '2026-10')).toBe(58_000);
    expect(parcelasTomadasDoMes([pessoal, outro], '2026-12')).toBe(48_000);
    expect(parcelasTomadasDoMes([pessoal], '2026-04')).toBe(0);
  });
});

describe('itemDoConcedido', () => {
  it('vira um item devido sem cartão, que vence na data combinada', () => {
    expect(
      itemDoConcedido({
        id: 3,
        terceiroId: 8,
        descricao: 'Empréstimo',
        valorCentavos: 80_000,
        data: '2026-08-15',
        prazo: '2026-10-15',
      }),
    ).toEqual({
      chave: 'e:3',
      emprestimoId: 3,
      compraId: 0,
      numero: 1,
      numParcelas: 1,
      descricao: 'Empréstimo',
      dataCompra: '2026-08-15',
      cartaoId: 0,
      competencia: '2026-10',
      vencimento: '2026-10-15',
      valor: 80_000,
    });
  });
});
