import { useEffect, useRef, useState } from 'react';
import { MOVIMENTO, gsap } from '@/lib/gsap';

export function useContagem(alvo: number): number {
  const [exibido, setExibido] = useState(alvo);
  const anterior = useRef(alvo);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = alvo;
    if (de === alvo) return;
    const reduzido = window.matchMedia(MOVIMENTO.reduzido).matches;
    const estado = { valor: de };
    const tween = gsap.to(estado, {
      valor: alvo,
      duration: reduzido ? 0 : 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        setExibido(Math.round(estado.valor));
      },
      onComplete: () => {
        setExibido(alvo);
      },
    });
    return () => {
      tween.kill();
      setExibido(alvo);
    };
  }, [alvo]);

  return exibido;
}
