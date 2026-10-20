import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, Flip);
gsap.defaults({ ease: 'power2.out', duration: 0.2 });

export const duracao = { micro: 0.12, componente: 0.2, pagina: 0.32 } as const;

export const movimento = {
  completo: '(prefers-reduced-motion: no-preference)',
  reduzido: '(prefers-reduced-motion: reduce)',
} as const;

export { gsap, Flip, useGSAP };
