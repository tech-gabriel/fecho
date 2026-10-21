import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { CABECALHO } from '@/domain/exportacao';
import { lerData, lerValor } from '@/domain/importacao';
import { gerarPlanilha } from './gerarPlanilha';

describe('gerarPlanilha', () => {
  it('grava data e valor formatados que o importador lê de volta', async () => {
    const bytes = await gerarPlanilha([
      {
        nome: 'Roxo',
        linhas: [CABECALHO, ['2026-10-31', 'Geladeira', 1234.56, '3 de 10', 'Eu', 'Casa']],
      },
    ]);

    const livro = XLSX.read(bytes, { type: 'array', cellNF: true });
    expect(livro.SheetNames).toEqual(['Roxo']);
    const folha = livro.Sheets.Roxo as XLSX.WorkSheet;
    expect((folha.A2 as XLSX.CellObject).z).toBe('dd/mm/yyyy');
    expect((folha.C2 as XLSX.CellObject).z).toBe('"R$" #,##0.00');

    const [cabecalho, linha] = XLSX.utils.sheet_to_json<unknown[]>(folha, {
      header: 1,
      raw: true,
    });
    expect(cabecalho).toEqual(CABECALHO);
    expect(lerData(linha?.[0] as number)).toBe('2026-10-31');
    expect(lerValor(linha?.[2] as number)).toBe(123_456);
    expect(linha?.slice(3)).toEqual(['3 de 10', 'Eu', 'Casa']);
  });
});
