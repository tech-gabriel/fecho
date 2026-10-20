import { describe, expect, it } from 'vitest';
import { backupAutomaticoPendente, nomeDoBackup } from './backup';

describe('backupAutomaticoPendente', () => {
  const agora = new Date(2026, 9, 20, 14, 0);

  it('pede backup quando nunca houve um', () => {
    expect(backupAutomaticoPendente(null, agora)).toBe(true);
  });

  it('pede backup depois de 24 horas, não antes', () => {
    expect(backupAutomaticoPendente(new Date(2026, 9, 19, 14, 1).toISOString(), agora)).toBe(false);
    expect(backupAutomaticoPendente(new Date(2026, 9, 19, 14, 0).toISOString(), agora)).toBe(true);
  });

  it('trata data inválida como sem backup', () => {
    expect(backupAutomaticoPendente('ontem', agora)).toBe(true);
  });
});

describe('nomeDoBackup', () => {
  it('usa data e hora locais com zeros à esquerda', () => {
    expect(nomeDoBackup(new Date(2026, 0, 5, 8, 3, 9))).toBe('fecho-2026-01-05-080309.db');
  });
});
