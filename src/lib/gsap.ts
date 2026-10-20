import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export const DURACAO = { micro: 0.12, componente: 0.2, pagina: 0.32 } as const;

export const MOVIMENTO = {
  normal: '(prefers-reduced-motion: no-preference)',
  reduzido: '(prefers-reduced-motion: reduce)',
};

export { gsap, useGSAP };
