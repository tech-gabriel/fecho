const canal = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminancia = (hex: string) =>
  0.2126 * canal(hex, 0) + 0.7152 * canal(hex, 1) + 0.0722 * canal(hex, 2);

const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export const ESCURECER_GRADIENTE = 0.72;

export function textoSobre(hex: string): 'claro' | 'escuro' {
  const clara = luminancia(hex);
  // misturar com preto em oklab escala L; a luminância linear cai com L³
  const escura = clara * ESCURECER_GRADIENTE ** 3;
  const pior = (texto: number) => Math.min(contraste(clara, texto), contraste(escura, texto));
  return pior(0) >= pior(1) ? 'escuro' : 'claro';
}
