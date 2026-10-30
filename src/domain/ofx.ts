import { lerValor } from './importacao';
import type { LinhaDoBanco } from './reconciliacao';

export class OfxInvalido extends Error {}

export function decodificarOfx(bytes: Uint8Array): string {
  const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 512));
  const charset = /CHARSET:\s*(\S+)/i.exec(inicio)?.[1] ?? '';
  const emWindows = /^(1252|ISO-?8859-?1)$/i.test(charset);
  return new TextDecoder(emWindows ? 'windows-1252' : 'utf-8').decode(bytes);
}

// OFX 1.x é SGML: as tags de valor podem não ter fechamento.
const campo = (bloco: string, tag: string) =>
  new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(bloco)?.[1]?.trim() ?? '';

export function lerOfx(texto: string): LinhaDoBanco[] {
  const blocos = [...texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map((m) => m[1] ?? '');
  const linhas = blocos.flatMap((bloco) => {
    const data = campo(bloco, 'DTPOSTED');
    const valor = lerValor(campo(bloco, 'TRNAMT'));
    if (!/^\d{8}/.test(data) || valor === null) return [];
    return [
      {
        data: `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}`,
        descricao: (campo(bloco, 'MEMO') || campo(bloco, 'NAME')).replace(/\s+/g, ' '),
        valor,
      },
    ];
  });
  if (linhas.length === 0) throw new OfxInvalido('Esse arquivo OFX não tem lançamentos.');
  const negativas = linhas.filter((l) => l.valor < 0).length;
  return negativas > linhas.length / 2 ? linhas.map((l) => ({ ...l, valor: -l.valor })) : linhas;
}
