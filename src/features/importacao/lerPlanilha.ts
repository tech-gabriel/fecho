import type { Celula } from '@/domain/importacao';

export const LIMITE_EM_BYTES = 20 * 1024 * 1024;

export interface AbaLida {
  nome: string;
  linhas: Celula[][];
}

export interface PlanilhaLida {
  nome: string;
  tamanho: number;
  abas: AbaLida[];
}

export class PlanilhaInvalida extends Error {}

export async function lerPlanilha(arquivo: File): Promise<PlanilhaLida> {
  const csv = /\.csv$/i.test(arquivo.name);
  if (!csv && !/\.xlsx$/i.test(arquivo.name)) {
    throw new PlanilhaInvalida('Esse arquivo não é .xlsx nem .csv.');
  }
  if (arquivo.size > LIMITE_EM_BYTES) {
    throw new PlanilhaInvalida('O arquivo passa de 20 MB.');
  }

  const XLSX = await import('xlsx');
  let livro;
  try {
    livro = csv
      ? XLSX.read(await arquivo.text(), { type: 'string', raw: true })
      : XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
  } catch {
    throw new PlanilhaInvalida('Não deu para ler esse arquivo. Ele pode estar corrompido.');
  }

  const abas = livro.SheetNames.flatMap((nome) => {
    const folha = livro.Sheets[nome];
    if (!folha) return [];
    const linhas = XLSX.utils.sheet_to_json<Celula[]>(folha, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    return [{ nome: csv ? arquivo.name.replace(/\.csv$/i, '') : nome, linhas }];
  });
  if (abas.every((aba) => aba.linhas.length === 0)) {
    throw new PlanilhaInvalida('A planilha está vazia.');
  }
  return { nome: arquivo.name, tamanho: arquivo.size, abas };
}
