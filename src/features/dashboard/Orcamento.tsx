import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from 'cn';
import type { Categoria } from '@/data';
import type { Competencia } from '@/domain/competencia';
import type { FaixaDoOrcamento, SituacaoDoOrcamento } from '@/domain/orcamento';
import { iconeDaCategoria } from '@/features/cadastros/opcoes';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';

const BARRA: Record<FaixaDoOrcamento, string> = {
  ok: 'bg-success',
  perto: 'bg-warning',
  estourou: 'bg-danger',
};

function Selo({ situacao }: { situacao: SituacaoDoOrcamento }) {
  if (situacao.faixa === 'ok') return null;
  const estourou = situacao.faixa === 'estourou';
  const Icone = estourou ? CircleAlert : TriangleAlert;
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap',
        estourou ? 'bg-danger-bg text-danger-text' : 'bg-warning-bg text-warning-text',
      )}
    >
      <Icone size={12} strokeWidth={1.75} aria-hidden />
      {estourou ? `Passou ${formatarMoeda(situacao.gasto - situacao.limite)}` : 'Perto do limite'}
    </span>
  );
}

export function Orcamento({
  competencia,
  categorias,
  situacoes,
}: {
  competencia: Competencia;
  categorias: Categoria[];
  situacoes: SituacaoDoOrcamento[];
}) {
  const mes = nomeDoMes(competencia).split(' ')[0] ?? '';
  return (
    <section
      aria-labelledby="orcamento"
      className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
    >
      <h2 id="orcamento" className="text-base font-semibold">
        Orçamento de {mes}
      </h2>
      {situacoes.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">
          Defina um limite nas categorias para acompanhar aqui.{' '}
          <Link
            to="/configuracoes?secao=categorias"
            className="font-medium text-brand-text underline underline-offset-2"
          >
            Ir para Categorias
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-8 gap-y-4">
          {situacoes.map((situacao) => {
            const categoria = categorias.find((c) => c.id === situacao.categoriaId);
            const Icone = iconeDaCategoria(categoria?.icone ?? 'tag');
            const valores = `${formatarMoeda(situacao.gasto)} de ${formatarMoeda(situacao.limite)}`;
            return (
              <li key={situacao.categoriaId} className="flex flex-col gap-2">
                <span className="flex items-center gap-2">
                  <Icone size={16} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {categoria?.nome}
                  </span>
                  <Selo situacao={situacao} />
                </span>
                <span
                  role="progressbar"
                  aria-label={categoria?.nome}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(situacao.percentual, 100)}
                  aria-valuetext={valores}
                  className="h-2 overflow-hidden rounded-full bg-soft"
                >
                  <span
                    className={cn('block h-full rounded-full', BARRA[situacao.faixa])}
                    style={{ width: `${String(Math.min(situacao.percentual, 100))}%` }}
                  />
                </span>
                <span className="text-xs text-ink-muted tabular-nums">
                  {valores} · {situacao.percentual}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
