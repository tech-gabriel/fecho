import { useRef, type KeyboardEvent } from 'react';
import { cn } from 'cn';
import type { Cartao } from '@/data';
import { formatarMoeda } from '@/lib/formato';
import { dataCurta, destinoDaTecla } from '@/features/faturas/ListaDeCartoes';
import { Avatar, SeloDoTerceiro, type SituacaoDaPessoa } from './situacoes';

export function ondeEQuando(situacao: SituacaoDaPessoa, cartoes: Cartao[]) {
  const { prazo, itens, credito } = situacao;
  if (!prazo) return credito > 0 ? `Crédito de ${formatarMoeda(credito)}` : 'Tudo depositado';
  const item = itens.find((i) => i.aberto > 0 && i.vencimento === prazo);
  const cartao =
    item?.emprestimoId !== undefined
      ? 'Empréstimo'
      : cartoes.find((c) => c.id === item?.cartaoId)?.nome;
  return `${cartao ? `${cartao} · ` : ''}até ${dataCurta(prazo)}`;
}

export function ListaDePessoas({
  situacoes,
  cartoes,
  escolhida,
  onEscolher,
}: {
  situacoes: SituacaoDaPessoa[];
  cartoes: Cartao[];
  escolhida: number | undefined;
  onEscolher: (terceiroId: number) => void;
}) {
  const itens = useRef<(HTMLLIElement | null)[]>([]);
  const falta = situacoes.reduce((soma, s) => soma + s.falta, 0);

  const mover = (e: KeyboardEvent, indice: number) => {
    const destino = destinoDaTecla(e.key, indice, situacoes.length);
    const situacao = destino === null ? undefined : situacoes[destino];
    if (destino === null || !situacao) return;
    e.preventDefault();
    onEscolher(situacao.terceiro.id);
    itens.current[destino]?.focus();
  };

  return (
    <section
      aria-labelledby="receber-pessoas"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-surface"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 id="receber-pessoas" className="text-base font-semibold">
          Pessoas
        </h2>
        <span className="text-[13px] text-ink-muted tabular-nums">{formatarMoeda(falta)}</span>
      </div>
      <ul
        role="listbox"
        aria-labelledby="receber-pessoas"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {situacoes.map((situacao, indice) => {
          const ativa = situacao.terceiro.id === escolhida;
          return (
            <li
              key={situacao.terceiro.id}
              ref={(el) => {
                itens.current[indice] = el;
              }}
              role="option"
              aria-selected={ativa}
              tabIndex={ativa ? 0 : -1}
              onClick={() => {
                onEscolher(situacao.terceiro.id);
              }}
              onKeyDown={(e) => {
                mover(e, indice);
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                ativa ? 'bg-brand-subtle' : 'hover:bg-soft',
              )}
            >
              <Avatar nome={situacao.terceiro.nome} tamanho={32} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm font-semibold">
                    {situacao.terceiro.nome}
                  </span>
                  <span className="flex-none text-[13px] font-semibold tabular-nums">
                    {formatarMoeda(situacao.falta)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    title={ondeEQuando(situacao, cartoes)}
                    className={cn(
                      'truncate text-xs',
                      ativa ? 'text-ink-muted-on-tint' : 'text-ink-muted',
                    )}
                  >
                    {ondeEQuando(situacao, cartoes)}
                  </span>
                  <SeloDoTerceiro status={situacao.status} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
