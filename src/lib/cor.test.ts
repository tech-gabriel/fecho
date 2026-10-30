import { describe, expect, it } from 'vitest';
import { textoSobre } from './cor';

describe('textoSobre', () => {
  it('usa texto escuro em cores claras e claro em cores escuras', () => {
    expect(textoSobre('#FFFFFF')).toBe('escuro');
    expect(textoSobre('#FDE047')).toBe('escuro');
    expect(textoSobre('#FF6000')).toBe('escuro');
    expect(textoSobre('#000000')).toBe('claro');
    expect(textoSobre('#57534E')).toBe('claro');
    expect(textoSobre('#6366F1')).toBe('claro');
  });

  it('aceita minúsculas', () => {
    expect(textoSobre('#fde047')).toBe('escuro');
  });
});
