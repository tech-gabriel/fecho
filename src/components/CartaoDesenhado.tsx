import { Nfc } from 'lucide-react';
import { cn } from 'cn';
import type { Bandeira, Cartao } from '@/data';
import { ESCURECER_GRADIENTE, textoSobre } from '@/lib/cor';

export const NOMES_DAS_BANDEIRAS: Record<Bandeira, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
};

const TAMANHOS = {
  p: {
    caixa: 'w-[176px] p-3 gap-1',
    banco: 'text-[11px]',
    numero: 'text-xs',
    nome: 'text-xs',
    chip: 'h-5 w-7',
    icone: 14,
  },
  g: {
    caixa: 'w-[280px] p-5 gap-2',
    banco: 'text-sm',
    numero: 'text-base',
    nome: 'text-sm',
    chip: 'h-7 w-10',
    icone: 20,
  },
};

type Desenho = Pick<Cartao, 'nome' | 'cor' | 'banco' | 'final' | 'bandeira'>;

export function descreverCartao({ nome, banco, final, bandeira }: Desenho) {
  return [nome, banco, final && `final ${final}`, bandeira && NOMES_DAS_BANDEIRAS[bandeira]]
    .filter(Boolean)
    .join(', ');
}

export function CartaoDesenhado({
  cartao,
  tamanho,
  className,
}: {
  cartao: Desenho;
  tamanho: keyof typeof TAMANHOS;
  className?: string;
}) {
  const t = TAMANHOS[tamanho];
  const claro = textoSobre(cartao.cor) === 'claro';
  return (
    <div
      role="img"
      aria-label={descreverCartao(cartao)}
      style={{
        background: `linear-gradient(135deg, ${cartao.cor}, color-mix(in oklab, ${cartao.cor} ${ESCURECER_GRADIENTE * 100}%, black))`,
      }}
      className={cn(
        'flex aspect-[1.586] flex-none flex-col justify-between rounded-[10px] shadow-sm select-none',
        claro ? 'text-white' : 'text-[#1C1917]',
        t.caixa,
        className,
      )}
    >
      <div aria-hidden className="flex items-start justify-between gap-2">
        <span className={cn('truncate font-semibold', t.banco)}>{cartao.banco}</span>
        <Nfc size={t.icone} strokeWidth={1.75} className="flex-none opacity-80" />
      </div>
      <span
        aria-hidden
        className={cn(
          'rounded-[4px] bg-[linear-gradient(135deg,#F5D78E,#C9A24B)] ring-1 ring-black/15',
          t.chip,
        )}
      />
      <div aria-hidden className="flex flex-col">
        {cartao.final && (
          <span className={cn('font-medium tracking-wider tabular-nums', t.numero)}>
            •••• {cartao.final}
          </span>
        )}
        <div className="flex items-end justify-between gap-2">
          <span className={cn('truncate opacity-90', t.nome)}>{cartao.nome}</span>
          {cartao.bandeira && (
            <span className={cn('flex-none font-bold italic', t.nome)}>
              {NOMES_DAS_BANDEIRAS[cartao.bandeira]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
