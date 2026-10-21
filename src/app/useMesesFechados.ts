import { useEffect, useState } from 'react';
import { useRepositorios } from './repositorios';
import { useApp } from './store';

export function useMesesFechados(): ReadonlySet<string> {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const [fechados, setFechados] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let montado = true;
    void repos.fechamento.fechados().then((lista) => {
      if (montado) setFechados(new Set(lista));
    });
    return () => {
      montado = false;
    };
  }, [repos, versao]);

  return fechados;
}
