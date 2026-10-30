import { useId } from 'react';
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
  const ouro = useId();
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
      <svg aria-hidden viewBox="0 0 40 30" className={cn('drop-shadow-sm', t.chip)}>
        <defs>
          <linearGradient id={ouro} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F7E2A6" />
            <stop offset="0.45" stopColor="#D9B45E" />
            <stop offset="1" stopColor="#A9822F" />
          </linearGradient>
        </defs>
        <rect
          x="0.5"
          y="0.5"
          width="39"
          height="29"
          rx="5"
          fill={`url(#${ouro})`}
          stroke="#8A6A25"
          strokeOpacity="0.6"
        />
        <g fill="none" stroke="#7A5C1E" strokeOpacity="0.55" strokeWidth="0.9">
          <path d="M0.5 10H13M0.5 20H13M27 10H39.5M27 20H39.5" />
          <path d="M13 0.5V29.5M27 0.5V29.5M13 15H27" />
          <rect x="15.5" y="8" width="9" height="14" rx="2.5" />
        </g>
      </svg>
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
