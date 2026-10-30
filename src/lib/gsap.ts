import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, Flip);

export const DURACAO = { micro: 0.12, componente: 0.2, pagina: 0.32 } as const;

export const MOVIMENTO = {
  normal: '(prefers-reduced-motion: no-preference)',
  reduzido: '(prefers-reduced-motion: reduce)',
};

export { Flip, gsap, useGSAP };

export const reduzirMovimento = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(MOVIMENTO.reduzido).matches;
