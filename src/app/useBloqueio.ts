import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { minutosParaBloquear } from '@/domain/seguranca';
import { useRepositorios } from './repositorios';
import { useApp } from './store';

const EVENTOS_DE_USO = ['pointerdown', 'keydown', 'wheel'] as const;

export function usePedirBloqueio() {
  const navigate = useNavigate();
  const pinAtivo = useApp((s) => s.pinAtivo);
  const bloquear = useApp((s) => s.bloquear);
  return useCallback(() => {
    if (pinAtivo) {
      bloquear('atalho');
      return;
    }
    void navigate('/configuracoes?secao=seguranca');
    toast.info('Defina um PIN para bloquear o Fechô.');
  }, [pinAtivo, bloquear, navigate]);
}

export function useBloqueio() {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const pinAtivo = useApp((s) => s.pinAtivo);
  const bloqueado = useApp((s) => s.bloqueio !== null);
  const definirPinAtivo = useApp((s) => s.definirPinAtivo);
  const bloquear = useApp((s) => s.bloquear);
  const pedirBloqueio = usePedirBloqueio();
  const [minutos, setMinutos] = useState<number | null>(null);

  useEffect(() => {
    let montado = true;
    void repos.seguranca.estado().then(({ pinAtivo: ativo }) => {
      if (!montado) return;
      definirPinAtivo(ativo);
      if (ativo) bloquear('inicio');
    });
    return () => {
      montado = false;
    };
  }, [repos, definirPinAtivo, bloquear]);

  useEffect(() => {
    let montado = true;
    void repos.preferencias.ler().then((p) => {
      if (montado) setMinutos(minutosParaBloquear(p.bloquearAposMinutos));
    });
    return () => {
      montado = false;
    };
  }, [repos, versao]);

  useEffect(() => {
    if (!pinAtivo || bloqueado || minutos === null) return;
    let relogio = setTimeout(() => {
      bloquear('inatividade');
    }, minutos * 60_000);
    const reiniciar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => {
        bloquear('inatividade');
      }, minutos * 60_000);
    };
    for (const evento of EVENTOS_DE_USO) window.addEventListener(evento, reiniciar);
    return () => {
      clearTimeout(relogio);
      for (const evento of EVENTOS_DE_USO) window.removeEventListener(evento, reiniciar);
    };
  }, [pinAtivo, bloqueado, minutos, bloquear]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'l' || bloqueado) return;
      e.preventDefault();
      pedirBloqueio();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [bloqueado, pedirBloqueio]);
}
