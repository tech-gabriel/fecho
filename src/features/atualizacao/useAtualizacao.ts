import { useEffect } from 'react';
import { toast } from 'sonner';
import { procurarAtualizacao, type Atualizacao } from './atualizacao';

const ID = 'atualizacao';

export function oferecerAtualizacao({ versao, instalar }: Atualizacao) {
  const atualizar = () => {
    toast.loading(`Baixando o Fechô ${versao}…`, {
      id: ID,
      description: 'O app reinicia sozinho quando terminar.',
      duration: Infinity,
    });
    instalar().catch(() => {
      toast.error('Não foi possível atualizar. Confira a internet e tente de novo.', {
        id: ID,
        description: undefined,
        duration: Infinity,
        action: { label: 'Tentar de novo', onClick: atualizar },
      });
    });
  };
  toast(`Versão ${versao} disponível`, {
    id: ID,
    description: 'Seus dados continuam como estão.',
    duration: Infinity,
    action: { label: 'Atualizar e reiniciar', onClick: atualizar },
  });
}

export function useAtualizacaoAoAbrir() {
  useEffect(() => {
    let ativo = true;
    procurarAtualizacao()
      .then((atualizacao) => {
        if (ativo && atualizacao) oferecerAtualizacao(atualizacao);
      })
      // ao abrir sem internet o Fechô segue offline, sem aviso
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);
}
