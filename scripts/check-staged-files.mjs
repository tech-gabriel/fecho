import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function arquivosProibidos(caminhos) {
  return caminhos.filter(
    (caminho) =>
      caminho !== 'README.md' && (/\.mdx?$/i.test(caminho) || /(^|\/)docs\//.test(caminho)),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });
  const proibidos = arquivosProibidos(staged.split('\n').filter(Boolean));
  if (proibidos.length > 0) {
    console.error('Documentação não entra no repositório. Remova do stage:');
    for (const caminho of proibidos) console.error(`  ${caminho}`);
    process.exit(1);
  }
}
