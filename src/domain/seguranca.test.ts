import { describe, expect, it } from 'vitest';
import {
  MAXIMO_DE_TENTATIVAS,
  esperaAte,
  minutosParaBloquear,
  tentativasRestantes,
  validarPin,
  validarSenhaDeBackup,
} from './seguranca';

describe('validarPin', () => {
  it('aceita exatamente 4 dígitos', () => {
    expect(validarPin('2580')).toBe(true);
    expect(validarPin('258')).toBe(false);
    expect(validarPin('25801')).toBe(false);
    expect(validarPin('25a0')).toBe(false);
    expect(validarPin(' 2580')).toBe(false);
  });
});

describe('tentativas', () => {
  it('conta o que sobra e manda esperar 60s depois do 5º erro', () => {
    expect(MAXIMO_DE_TENTATIVAS).toBe(5);
    expect(tentativasRestantes(0)).toBe(5);
    expect(tentativasRestantes(4)).toBe(1);
    expect(tentativasRestantes(7)).toBe(0);
    expect(esperaAte(4, 1_000)).toBeNull();
    expect(esperaAte(5, 1_000)).toBe(61_000);
  });
});

describe('validarSenhaDeBackup', () => {
  it('pede 8 caracteres e a confirmação igual', () => {
    expect(validarSenhaDeBackup('curta', 'curta')).toBe('Use pelo menos 8 caracteres');
    expect(validarSenhaDeBackup('senha-longa', 'senha-longx')).toBe('As senhas não são iguais');
    expect(validarSenhaDeBackup('senha-longa', 'senha-longa')).toBeNull();
  });
});

describe('minutosParaBloquear', () => {
  it('aceita as opções conhecidas e cai no padrão de 5 minutos', () => {
    expect(minutosParaBloquear(15)).toBe(15);
    expect(minutosParaBloquear(null)).toBeNull();
    expect(minutosParaBloquear(7)).toBe(5);
  });
});
