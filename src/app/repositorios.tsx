import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { criarRepositorios, type Repositorios } from '@/data';

type Estado =
  { status: 'carregando' } | { status: 'pronto'; repos: Repositorios } | { status: 'erro' };

const ContextoRepositorios = createContext<Repositorios | null>(null);

export function RepositoriosProvider({
  children,
  criar = criarRepositorios,
}: {
  children: ReactNode;
  criar?: () => Promise<Repositorios>;
}) {
  const [estado, setEstado] = useState<Estado>({ status: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    criar().then(
      (repos) => {
        if (ativo) setEstado({ status: 'pronto', repos });
      },
      () => {
        if (ativo) setEstado({ status: 'erro' });
      },
    );
    return () => {
      ativo = false;
    };
  }, [criar, tentativa]);

  if (estado.status === 'carregando') return null;

  if (estado.status === 'erro') {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-danger-bg">
          <TriangleAlert size={24} strokeWidth={1.75} className="text-danger" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Não foi possível abrir seus dados.</h1>
          <p className="text-sm text-ink-muted">O Fechô não conseguiu ler o banco de dados.</p>
        </div>
        <Button
          onClick={() => {
            setEstado({ status: 'carregando' });
            setTentativa((t) => t + 1);
          }}
        >
          Tentar de novo
        </Button>
      </main>
    );
  }

  return <ContextoRepositorios value={estado.repos}>{children}</ContextoRepositorios>;
}

export function useRepositorios(): Repositorios {
  const repos = use(ContextoRepositorios);
  if (!repos) throw new Error('useRepositorios fora do RepositoriosProvider');
  return repos;
}
