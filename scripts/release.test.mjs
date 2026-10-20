import { describe, expect, it } from 'vitest';
import { comVersaoCargo, proximaVersao } from './release.mjs';

describe('release', () => {
  it.each([
    ['0.1.0', 'patch', '0.1.1'],
    ['0.1.9', 'minor', '0.2.0'],
    ['1.4.2', 'major', '2.0.0'],
    ['0.1.0', '1.0.0', '1.0.0'],
  ])('%s + %s = %s', (atual, pedido, esperado) => {
    expect(proximaVersao(atual, pedido)).toBe(esperado);
  });

  it.each(['1.0', 'v1.0.0', 'grande', '0.0.9'])('rejeita "%s"', (pedido) => {
    expect(() => proximaVersao('0.1.0', pedido)).toThrow();
  });

  it('troca só a versão do pacote fecho no Cargo.toml e no Cargo.lock', () => {
    const toml =
      '[package]\nname = "fecho"\nversion = "0.1.0"\n\n[dependencies]\nx = { version = "0.1.0" }\n';
    expect(comVersaoCargo(toml, '0.2.0')).toBe(
      toml.replace('version = "0.1.0"\n\n', 'version = "0.2.0"\n\n'),
    );

    const lock =
      '[[package]]\nname = "fecho"\nversion = "0.1.0"\n\n[[package]]\nname = "outro"\nversion = "0.1.0"\n';
    expect(comVersaoCargo(lock, '0.2.0')).toContain('name = "fecho"\nversion = "0.2.0"');
    expect(comVersaoCargo(lock, '0.2.0')).toContain('name = "outro"\nversion = "0.1.0"');
  });
});
