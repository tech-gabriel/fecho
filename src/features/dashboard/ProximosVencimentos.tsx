import type { DataLocal } from '@/domain/competencia';
import type { FaturaDoCartao } from '@/features/faturas/Faturas';
import { quando, SeloDeStatus } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda } from '@/lib/formato';

export function ProximosVencimentos({
  faturas,
  hoje,
}: {
  faturas: FaturaDoCartao[];
  hoje: DataLocal;
}) {
  const comCompras = faturas
    .filter((f) => f.resumo.total > 0)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  return (
    <section
      aria-labelledby="proximos-vencimentos"
      className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
    >
      <h2 id="proximos-vencimentos" className="text-base font-semibold">
        Próximos vencimentos
      </h2>
      {comCompras.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nada vence neste mês.</p>
      ) : (
        <ul className="flex flex-col">
          {comCompras.map((fatura) => (
            <li
              key={fatura.cartao.id}
              className="flex items-center gap-3 border-t py-3 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden
                style={{ backgroundColor: fatura.cartao.cor }}
                className="h-4 w-6 flex-none rounded-sm"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{fatura.cartao.nome}</span>
                <span className="truncate text-xs text-ink-muted">{quando(fatura, hoje)}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatarMoeda(fatura.resumo.total)}
              </span>
              <SeloDeStatus status={fatura.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
