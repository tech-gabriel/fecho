import { UserRound } from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Terceiro } from '@/data';
import type { ModoDaCompra } from '@/domain/compras';
import { idDoErro } from '@/features/cadastros/Campo';

export interface ParteDePessoa {
  terceiroId: number;
  percentual: number;
}

const MODOS: [ModoDaCompra, string][] = [
  ['minha', 'Minha'],
  ['outra', 'De outra pessoa'],
  ['dividida', 'Dividida'],
];

function dividirIgualmente(ids: number[]): ParteDePessoa[] {
  const cada = Math.floor(100 / (ids.length + 1));
  return ids.map((terceiroId) => ({ terceiroId, percentual: cada }));
}

export function ParaQuem({
  id,
  modo,
  pessoas,
  terceiros,
  erro,
  onModo,
  onPessoas,
}: {
  id: string;
  modo: ModoDaCompra;
  pessoas: ParteDePessoa[];
  terceiros: Terceiro[];
  erro: string | undefined;
  onModo: (modo: ModoDaCompra) => void;
  onPessoas: (pessoas: ParteDePessoa[]) => void;
}) {
  const nome = (terceiroId: number) => terceiros.find((t) => t.id === terceiroId)?.nome ?? '';
  const escolhida = (terceiroId: number) => pessoas.some((p) => p.terceiroId === terceiroId);
  const minhaParte = 100 - pessoas.reduce((soma, p) => soma + (p.percentual || 0), 0);

  const alternar = (terceiroId: number) => {
    if (modo === 'outra') {
      onPessoas([{ terceiroId, percentual: 100 }]);
      return;
    }
    const ids = pessoas.map((p) => p.terceiroId);
    onPessoas(
      dividirIgualmente(
        escolhida(terceiroId) ? ids.filter((i) => i !== terceiroId) : [...ids, terceiroId],
      ),
    );
  };

  const mudarModo = (novo: ModoDaCompra) => {
    onModo(novo);
    const primeira = pessoas[0]?.terceiroId;
    if (novo === 'outra' && primeira !== undefined)
      onPessoas([{ terceiroId: primeira, percentual: 100 }]);
    if (novo === 'dividida') onPessoas(dividirIgualmente(pessoas.map((p) => p.terceiroId)));
  };

  const dica =
    pessoas.length === 0
      ? modo === 'outra'
        ? 'Escolha quem vai pagar.'
        : 'Escolha com quem dividir.'
      : modo === 'outra'
        ? `${nome(pessoas[0]?.terceiroId ?? 0)} deposita o valor todo antes do vencimento`
        : pessoas.length === 1
          ? `${nome(pessoas[0]?.terceiroId ?? 0)} deposita ${pessoas[0]?.percentual ?? 0}% de cada parcela`
          : 'Cada pessoa deposita a parte dela de cada parcela';

  return (
    <fieldset
      className="flex flex-col gap-2 border-0 p-0"
      aria-describedby={erro ? idDoErro(id) : undefined}
    >
      <legend className="mb-2 text-[13px] leading-[18px] font-medium">De quem é?</legend>
      <ToggleGroup
        type="single"
        variant="outline"
        value={modo}
        onValueChange={(valor) => {
          if (valor) mudarModo(valor as ModoDaCompra);
        }}
        className="w-full"
      >
        {MODOS.map(([valor, rotulo]) => (
          <ToggleGroupItem
            key={valor}
            value={valor}
            className="flex-1 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
          >
            {rotulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {modo !== 'minha' &&
        (terceiros.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Cadastre as pessoas em Configurações para dividir compras.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {terceiros.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={escolhida(t.id)}
                  onClick={() => {
                    alternar(t.id);
                  }}
                  className={cn(
                    'flex h-7 items-center gap-1 rounded-full border px-3 text-[13px] font-medium',
                    escolhida(t.id)
                      ? 'border-transparent bg-info-bg text-info-text'
                      : 'hover:bg-soft',
                  )}
                >
                  <UserRound size={12} strokeWidth={1.75} aria-hidden />
                  {t.nome}
                </button>
              ))}
            </div>

            {modo === 'dividida' && pessoas.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                {pessoas.map((p) => (
                  <label key={p.terceiroId} className="flex items-center gap-2">
                    <span className="font-medium">{nome(p.terceiroId)}</span>
                    <span className="relative">
                      <Input
                        aria-label={`Percentual de ${nome(p.terceiroId)}`}
                        inputMode="numeric"
                        value={Number.isNaN(p.percentual) ? '' : String(p.percentual)}
                        onChange={(e) => {
                          onPessoas(
                            pessoas.map((outra) =>
                              outra.terceiroId === p.terceiroId
                                ? {
                                    ...outra,
                                    percentual: e.target.value
                                      ? Number(e.target.value)
                                      : Number.NaN,
                                  }
                                : outra,
                            ),
                          );
                        }}
                        className="h-8 w-16 pr-6 text-right tabular-nums"
                      />
                      <span
                        aria-hidden
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-muted"
                      >
                        %
                      </span>
                    </span>
                  </label>
                ))}
                <span className="text-ink-muted tabular-nums">
                  Você: {Math.max(minhaParte, 0)}%
                </span>
              </div>
            )}

            {erro ? (
              <p id={idDoErro(id)} className="text-xs text-danger-text">
                {erro}
              </p>
            ) : (
              <p className="text-xs text-ink-muted">{dica}</p>
            )}
          </>
        ))}
    </fieldset>
  );
}
