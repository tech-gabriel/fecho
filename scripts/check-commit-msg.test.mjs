import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { violacoes } from './check-commit-msg.mjs';

describe('check-commit-msg', () => {
  it('aceita uma mensagem convencional com corpo e rodapé', () => {
    const mensagem = 'feat(compras): gera parcelas\n\nCorpo explicando o porquê.\n\nRefs #12\n';
    expect(violacoes(mensagem)).toEqual([]);
  });

  it.each([
    'Co-Authored-By: Alguém <a@b.c>',
    'co-authored-by: alguém <a@b.c>',
    'Agente-Session: 123',
    'Qualquer-session: abc',
    'Texto Generated with alguma coisa',
    '🤖 generated with x',
  ])('rejeita a linha "%s"', (linha) => {
    expect(violacoes(`fix(ui): corrige foco\n\n${linha}\n`)).toHaveLength(1);
  });

  it('ignora linhas de comentário do git', () => {
    expect(violacoes('fix: algo\n# Co-Authored-By: comentário\n')).toEqual([]);
  });

  it('não confunde menção no meio da linha com trailer', () => {
    expect(violacoes('docs: explica o trailer Co-Authored-By: proibido\n')).toEqual([]);
  });
});

describe('check-commit-msg na linha de comando', () => {
  const rodar = (mensagem) => {
    const pasta = mkdtempSync(join(tmpdir(), 'commit-msg-'));
    const arquivo = join(pasta, 'COMMIT_EDITMSG');
    writeFileSync(arquivo, mensagem);
    return spawnSync(process.execPath, ['scripts/check-commit-msg.mjs', arquivo]).status;
  };

  it('sai com 0 para mensagem válida e 1 para trailer proibido', () => {
    expect(rodar('fix: ok\n')).toBe(0);
    expect(rodar('fix: ok\n\nCo-Authored-By: x <x@x>\n')).toBe(1);
  });
});
