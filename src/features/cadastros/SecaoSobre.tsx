import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { atualizacaoDisponivel, procurarAtualizacao } from '@/features/atualizacao/atualizacao';
import { oferecerAtualizacao } from '@/features/atualizacao/useAtualizacao';

type Estado = 'parado' | 'procurando' | 'em-dia' | 'falhou' | 'encontrada';

const TEXTO: Record<Estado, string> = {
  parado: 'O Fechô procura uma versão nova toda vez que abre.',
  procurando: 'Procurando…',
  'em-dia': 'Você já está na versão mais recente.',
  falhou: 'Não foi possível procurar. Confira a internet e tente de novo.',
  encontrada: 'Tem versão nova. Veja o aviso no canto da tela.',
};

export function SecaoSobre() {
  const [estado, setEstado] = useState<Estado>('parado');

  const procurar = async () => {
    setEstado('procurando');
    try {
      const atualizacao = await procurarAtualizacao();
      if (atualizacao) oferecerAtualizacao(atualizacao);
      setEstado(atualizacao ? 'encontrada' : 'em-dia');
    } catch {
      setEstado('falhou');
    }
  };

  return (
    <section
      id="sobre"
      aria-labelledby="sobre-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="sobre-titulo" className="text-base font-semibold">
        Sobre
      </h2>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Fechô {__VERSAO__}</p>
        <p className="text-[13px] text-ink-muted">Seus dados ficam só neste computador.</p>
      </div>
      <div className="flex items-center gap-3 border-t pt-4">
        <p role="status" className="flex-1 text-sm text-ink-muted">
          {atualizacaoDisponivel()
            ? TEXTO[estado]
            : 'No navegador não há atualização: ela vem pelo app instalado.'}
        </p>
        <Button
          variant="outline"
          disabled={!atualizacaoDisponivel() || estado === 'procurando'}
          onClick={() => void procurar()}
        >
          <RefreshCw strokeWidth={1.75} />
          Procurar atualizações
        </Button>
      </div>
    </section>
  );
}
