import { entradaDeInteiro } from '@/lib/entrada';
import { Fragment } from 'react';
import { format, parse } from 'date-fns';
import { Layers } from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import type { Cartao, Terceiro } from '@/data';
import type { ParcelaDaPrevia } from '@/domain/compras';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import { idDoErro } from '@/features/cadastros/Campo';

const OPCOES = [1, 2, 3, 6, 10, 12];

const mes = (competencia: string) => nomeDoMes(competencia).split(' ')[0] ?? '';
const vencimento = (data: string) => format(parse(data, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');

export function Parcelas({
  id,
  numParcelas,
  erro,
  onEscolher,
}: {
  id: string;
  numParcelas: number;
  erro: string | undefined;
  onEscolher: (n: number) => void;
}) {
  const outro = !OPCOES.includes(numParcelas);

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[13px] leading-[18px] font-medium">Parcelas</legend>
      <div className="flex flex-wrap items-center gap-2">
        {OPCOES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={numParcelas === n}
            onClick={() => {
              onEscolher(n);
            }}
            className={cn(
              'h-7 rounded-md border px-3 text-[13px] font-medium tabular-nums',
              numParcelas === n
                ? 'border-transparent bg-brand-subtle font-semibold'
                : 'hover:bg-soft',
            )}
          >
            {n === 1 ? 'À vista' : `${n}×`}
          </button>
        ))}
        <Input
          id={id}
          aria-label="Outro número de parcelas"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idDoErro(id) : undefined}
          {...entradaDeInteiro(2)}
          placeholder="Outro"
          value={outro && !Number.isNaN(numParcelas) ? String(numParcelas) : ''}
          onChange={(e) => {
            onEscolher(e.target.value ? Number(e.target.value) : Number.NaN);
          }}
          className={cn('h-7 w-20 tabular-nums', outro && 'border-brand bg-brand-subtle')}
        />
      </div>
      {erro && (
        <p id={idDoErro(id)} className="text-xs text-danger-text">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

export function PreviaDasParcelas({
  previa,
  cartao,
  terceiros,
}: {
  previa: ParcelaDaPrevia[] | null;
  cartao: Cartao | undefined;
  terceiros: Terceiro[];
}) {
  if (!previa || !cartao) {
    return <p className="text-xs text-ink-muted">Digite o valor para ver as parcelas</p>;
  }

  const total = previa.length;
  const visiveis = total <= 4 ? previa : [...previa.slice(0, 3), null, previa[total - 1]];
  const nome = (terceiroId: number) => terceiros.find((t) => t.id === terceiroId)?.nome ?? '';
  const primeira = previa[0];

  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label="Prévia das parcelas"
        className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-3 overflow-hidden rounded-md border"
      >
        {visiveis.map((p, i) =>
          p ? (
            <li
              key={p.numero}
              className={cn(
                'col-span-4 grid grid-cols-subgrid items-center border-t px-3 py-2 text-[13px] leading-[18px] font-medium first:border-t-0',
                i === 0 && 'bg-soft',
              )}
            >
              <span className="flex items-center gap-1 tabular-nums">
                <Layers size={12} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
                {p.numero}/{total}
              </span>
              <span className="truncate">Fatura de {mes(p.competencia)}</span>
              <span className="font-normal text-ink-muted tabular-nums">
                vence {vencimento(p.vencimento)}
              </span>
              <span className="flex flex-col items-end tabular-nums">
                {formatarMoeda(p.valorCentavos)}
                {[...p.porTerceiro].map(([terceiroId, valor]) => (
                  <span key={terceiroId} className="text-xs font-normal text-info-text">
                    {nome(terceiroId)} {formatarMoeda(valor)}
                  </span>
                ))}
              </span>
            </li>
          ) : (
            <Fragment key="intervalo">
              <li aria-hidden className="col-span-4 border-t px-3 text-[13px] text-ink-muted">
                ⋯
              </li>
            </Fragment>
          ),
        )}
      </ol>
      {primeira && (
        <p className="text-xs text-ink-muted">
          {total === 1 ? 'À vista' : `${total}× de ${formatarMoeda(primeira.valorCentavos)}`} · a 1ª
          entra na fatura de {mes(primeira.competencia)} porque o {cartao.nome} fecha no dia{' '}
          {cartao.diaFechamento}
        </p>
      )}
    </div>
  );
}
