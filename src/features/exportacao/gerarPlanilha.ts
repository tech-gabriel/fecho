import type { AbaExportada } from '@/domain/exportacao';

const DIA_EM_MS = 86_400_000;
const LARGURAS = [12, 36, 14, 10, 16, 18];

const serialDoExcel = (data: string) =>
  (Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) -
    Date.UTC(1899, 11, 30)) /
  DIA_EM_MS;

export async function gerarPlanilha(abas: readonly AbaExportada[]): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const livro = XLSX.utils.book_new();
  for (const aba of abas) {
    const linhas = aba.linhas.map((linha, i) =>
      i === 0 ? linha : [serialDoExcel(String(linha[0])), ...linha.slice(1)],
    );
    const folha = XLSX.utils.aoa_to_sheet(linhas);
    for (let r = 1; r < linhas.length; r++) {
      const data = folha[XLSX.utils.encode_cell({ r, c: 0 })] as { z?: string } | undefined;
      const valor = folha[XLSX.utils.encode_cell({ r, c: 2 })] as { z?: string } | undefined;
      if (data) data.z = 'dd/mm/yyyy';
      if (valor) valor.z = '"R$" #,##0.00';
    }
    folha['!cols'] = LARGURAS.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(livro, folha, aba.nome);
  }
  return new Uint8Array(XLSX.write(livro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
