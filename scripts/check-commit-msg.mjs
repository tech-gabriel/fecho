import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const proibidas = [/^co-authored-by:/i, /^\p{L}+-session:/iu, /generated with/i];

export function violacoes(mensagem) {
  return mensagem
    .split(/\r?\n/)
    .filter((linha) => !linha.startsWith('#'))
    .filter((linha) => proibidas.some((regra) => regra.test(linha.trim())));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const linhas = violacoes(readFileSync(process.argv[2], 'utf8'));
  if (linhas.length > 0) {
    console.error('Mensagem de commit com linhas não permitidas:');
    for (const linha of linhas) console.error(`  ${linha}`);
    process.exit(1);
  }
}
