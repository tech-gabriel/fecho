import { describe, expect, it } from 'vitest';
import { arquivosProibidos } from './check-staged-files.mjs';

describe('check-staged-files', () => {
  it('aceita código, configuração e assets', () => {
    expect(
      arquivosProibidos([
        'src/App.tsx',
        'package.json',
        'src-tauri/icons/icon.ico',
        'scripts/x.mjs',
      ]),
    ).toEqual([]);
  });

  it('rejeita markdown, mdx e qualquer coisa em docs/', () => {
    expect(
      arquivosProibidos([
        'CHANGELOG.md',
        'src/notas.MD',
        'pagina.mdx',
        'docs/adr.txt',
        'src/docs/x.ts',
        'src/App.tsx',
      ]),
    ).toEqual(['CHANGELOG.md', 'src/notas.MD', 'pagina.mdx', 'docs/adr.txt', 'src/docs/x.ts']);
  });

  it('aceita só o README.md da raiz', () => {
    expect(arquivosProibidos(['README.md', 'src/README.md', 'readme.md'])).toEqual([
      'src/README.md',
      'readme.md',
    ]);
  });

  it('não confunde nomes parecidos com docs/', () => {
    expect(arquivosProibidos(['src/mydocs/x.ts', 'docsy.ts'])).toEqual([]);
  });
});
