import { CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import type { ContaDoMes } from '@/domain/contasFixas';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda } from '@/lib/formato';

const SITUACAO = {
  paga: { icone: CircleCheck, cor: 'text-success-text' },
  atrasada: { icone: TriangleAlert, cor: 'text-danger-text' },
  pendente: { icone: Clock, cor: 'text-warning-text' },
};

function situacao(item: ContaDoMes) {
  if (item.pagamento) return `Paga em ${dataCurta(item.pagamento.pagoEm)}`;
  return `${item.status === 'atrasada' ? 'Venceu' : 'Vence'} ${dataCurta(item.vencimento)}`;
}

export function ForaDoCartao({
  itens,
  onPagar,
}: {
  itens: ContaDoMes[];
  onPagar: (item: ContaDoMes) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <section aria-labelledby="fora-do-cartao" className="cartao-do-dashboard flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <h2 id="fora-do-cartao" className="text-base font-semibold">
          Fora do cartão
        </h2>
        <Link to="/contas" className="text-[13px] font-medium text-brand-text hover:underline">
          Contas fixas
        </Link>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {[...itens]
          .sort((a, b) => Number(Boolean(a.pagamento)) - Number(Boolean(b.pagamento)))
          .map((item) => {
            const { icone: Icone, cor } = SITUACAO[item.status];
            return (
              <li
                key={item.conta.id}
                aria-label={item.conta.descricao}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-dashed px-4 py-3.5',
                  item.pagamento
                    ? 'bg-soft text-ink-muted-on-tint'
                    : 'border-border-strong bg-surface',
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{item.conta.descricao}</span>
                  <span className={cn('flex items-center gap-1 text-xs whitespace-nowrap', cor)}>
                    <Icone size={12} strokeWidth={1.75} aria-hidden />
                    {situacao(item)}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums">{formatarMoeda(item.valor)}</span>
                {!item.pagamento && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Marcar ${item.conta.descricao} como paga`}
                    onClick={() => {
                      onPagar(item);
                    }}
                  >
                    Paga
                  </Button>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
