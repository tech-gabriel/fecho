import { useRef, type KeyboardEvent } from 'react';
import { CircleCheck, Clock, Plus, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from 'cn';
import { diasEntre, type DataLocal } from '@/domain/competencia';
import type { StatusDaFatura } from '@/domain/faturas';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import type { FaturaDoCartao } from './Faturas';

export const dataCurta = (data: DataLocal) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

const STATUS = {
  paga: {
    rotulo: 'Paga',
    icone: CircleCheck,
    classe: 'bg-success-bg text-success-text',
    cor: 'text-success',
  },
  pendente: {
    rotulo: 'Pendente',
    icone: Clock,
    classe: 'bg-warning-bg text-warning-text',
    cor: 'text-warning',
  },
  atrasada: {
    rotulo: 'Atrasada',
    icone: TriangleAlert,
    classe: 'bg-danger-bg text-danger-text',
    cor: 'text-danger',
  },
} satisfies Record<StatusDaFatura, unknown>;

export function SeloDeStatus({ status, texto }: { status: StatusDaFatura; texto?: string }) {
  const { rotulo, icone: Icone, classe, cor } = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap',
        classe,
      )}
    >
      <Icone size={12} strokeWidth={1.75} aria-hidden className={cor} />
      {texto ?? rotulo}
    </span>
  );
}

export function quando(fatura: FaturaDoCartao, hoje: DataLocal) {
  if (fatura.parcelas.length === 0)
    return `Sem compras em ${nomeDoMes(fatura.competencia).split(' ')[0]}`;
  if (fatura.pagamento) return `Paga em ${dataCurta(fatura.pagamento.pagoEm)}`;
  const dias = diasEntre(hoje, fatura.vencimento);
  const vence = `Vence ${dataCurta(fatura.vencimento)}`;
  if (dias > 1) return `${vence} · em ${dias} dias`;
  if (dias === 1) return `${vence} · amanhã`;
  if (dias === 0) return `${vence} · hoje`;
  return `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`;
}

export function ListaDeCartoes({
  faturas,
  escolhida,
  hoje,
  onEscolher,
}: {
  faturas: FaturaDoCartao[];
  escolhida: number | undefined;
  hoje: DataLocal;
  onEscolher: (cartaoId: number) => void;
}) {
  const navigate = useNavigate();
  const itens = useRef<(HTMLLIElement | null)[]>([]);
  const total = faturas.reduce((soma, f) => soma + f.resumo.total, 0);

  const mover = (e: KeyboardEvent, indice: number) => {
    const destino =
      e.key === 'ArrowDown'
        ? indice + 1
        : e.key === 'ArrowUp'
          ? indice - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? faturas.length - 1
              : null;
    const fatura = destino === null ? undefined : faturas[destino];
    if (destino === null || !fatura) return;
    e.preventDefault();
    onEscolher(fatura.cartao.id);
    itens.current[destino]?.focus();
  };

  return (
    <section
      aria-labelledby="faturas-cartoes"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-surface"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 id="faturas-cartoes" className="text-base font-semibold">
          Cartões
        </h2>
        <span className="text-[13px] text-ink-muted tabular-nums">{formatarMoeda(total)}</span>
      </div>
      <ul
        role="listbox"
        aria-labelledby="faturas-cartoes"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {faturas.map((fatura, indice) => {
          const ativa = fatura.cartao.id === escolhida;
          return (
            <li
              key={fatura.cartao.id}
              ref={(el) => {
                itens.current[indice] = el;
              }}
              role="option"
              aria-selected={ativa}
              tabIndex={ativa ? 0 : -1}
              onClick={() => {
                onEscolher(fatura.cartao.id);
              }}
              onKeyDown={(e) => {
                mover(e, indice);
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-md px-3 py-2',
                ativa ? 'bg-brand-subtle' : 'hover:bg-soft',
              )}
            >
              <span className="contents">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{ backgroundColor: fatura.cartao.cor }}
                    className="h-[11px] w-4 flex-none rounded-sm"
                  />
                  <span className="flex-1 truncate text-sm font-semibold">
                    {fatura.cartao.nome}
                  </span>
                  <span className="flex-none text-[13px] font-semibold tabular-nums">
                    {formatarMoeda(fatura.resumo.total)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-xs',
                      ativa ? 'text-ink-muted-on-tint' : 'text-ink-muted',
                    )}
                  >
                    {quando(fatura, hoje)}
                  </span>
                  {fatura.parcelas.length > 0 && <SeloDeStatus status={fatura.status} />}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="p-2">
        <button
          type="button"
          onClick={() => void navigate('/configuracoes')}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong text-sm font-medium text-ink-muted hover:bg-soft"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          Novo cartão
        </button>
      </div>
    </section>
  );
}
