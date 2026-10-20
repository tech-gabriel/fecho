import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { lerReais } from '@/domain/money';
import { sugerirAbatimento, type ItemComSituacao } from '@/domain/receber';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarDecimal, formatarMoeda } from '@/lib/formato';

function lerValor(texto: string) {
  try {
    return lerReais(texto);
  } catch {
    return 0;
  }
}

export function RegistrarDeposito({
  nome,
  falta,
  abertos,
  onRegistrar,
}: {
  nome: string;
  falta: number;
  abertos: ItemComSituacao[];
  onRegistrar: (valor: number, escolhidos: ItemComSituacao[]) => void;
}) {
  const [texto, setTexto] = useState(falta > 0 ? formatarDecimal(falta) : '');
  const [marcadas, setMarcadas] = useState(() => new Set(sugerirAbatimento(abertos, falta)));
  const valor = lerValor(texto);
  const escolhidos = abertos.filter((i) => marcadas.has(i.chave));
  const coberto = escolhidos.reduce((soma, i) => soma + i.aberto, 0);

  const dica =
    valor <= 0
      ? 'Digite um valor maior que zero'
      : valor < falta
        ? `Fica faltando ${formatarMoeda(falta - valor)} · status vira Parcial`
        : valor > falta
          ? `Sobram ${formatarMoeda(valor - falta)} de crédito para ${nome}`
          : `Quita tudo o que ${nome} deve`;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor > 0) onRegistrar(valor, escolhidos);
      }}
    >
      <label htmlFor="valor-do-deposito" className="text-sm font-semibold">
        Quanto {nome} depositou?
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
          R$
        </span>
        <Input
          id="valor-do-deposito"
          inputMode="decimal"
          autoComplete="off"
          className="pl-9 tabular-nums"
          value={texto}
          aria-describedby="dica-do-deposito"
          onChange={(e) => {
            setTexto(e.target.value);
            setMarcadas(new Set(sugerirAbatimento(abertos, lerValor(e.target.value))));
          }}
        />
      </div>
      <p id="dica-do-deposito" aria-live="polite" className="text-xs text-ink-muted">
        {dica}
      </p>
      {abertos.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-medium text-ink-muted">Abate de</legend>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {abertos.map((item) => (
              <label
                key={item.chave}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-1 text-[13px] hover:bg-soft"
              >
                <Checkbox
                  checked={marcadas.has(item.chave)}
                  onCheckedChange={(marcada) => {
                    const novas = new Set(marcadas);
                    if (marcada === true) novas.add(item.chave);
                    else novas.delete(item.chave);
                    setMarcadas(novas);
                  }}
                />
                <span className="flex-1 truncate">
                  {item.descricao}
                  {item.numParcelas > 1 && ` ${item.numero}/${item.numParcelas}`}
                </span>
                <span className="flex-none text-xs text-ink-muted">
                  {dataCurta(item.vencimento)}
                </span>
                <span className="w-20 flex-none text-right tabular-nums">
                  {formatarMoeda(item.aberto)}
                </span>
              </label>
            ))}
          </div>
          {valor > coberto && (
            <p className="text-xs text-ink-muted">
              {formatarMoeda(valor - coberto)} sem compra marcada ficam como crédito.
            </p>
          )}
        </fieldset>
      )}
      <Button type="submit" disabled={valor <= 0}>
        Registrar depósito
      </Button>
    </form>
  );
}
