import { CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Cartao } from '@/data';
import type { Celula, Destino } from '@/domain/importacao';
import { faltasDaAba, type ConfigDaAba } from './Importacao';
import type { PlanilhaLida } from './lerPlanilha';

const DESTINOS: [Destino, string][] = [
  ['data', 'Data'],
  ['descricao', 'Descrição'],
  ['valor', 'Valor'],
  ['cartao', 'Cartão'],
  ['parcela', 'Parcelas'],
  ['dono', 'De quem'],
  ['categoria', 'Categoria'],
  ['ignorar', 'Ignorar'],
];

const exibir = (celula: Celula) =>
  celula === null || celula === undefined || celula === '' ? '—' : String(celula);

const letra = (i: number) => String.fromCharCode(65 + (i % 26));

export function PassoColunas({
  planilha,
  config,
  abaAtual,
  cartoes,
  onAbaAtual,
  onConfig,
}: {
  planilha: PlanilhaLida;
  config: ConfigDaAba[];
  abaAtual: number;
  cartoes: Cartao[];
  onAbaAtual: (indice: number) => void;
  onConfig: (indice: number, mudanca: Partial<ConfigDaAba>) => void;
}) {
  const aba = planilha.abas[abaAtual];
  const atual = config[abaAtual];
  if (!aba || !atual) return null;
  const cabecalho = aba.linhas[atual.cabecalho] ?? [];
  const amostras = aba.linhas.slice(atual.cabecalho + 1, atual.cabecalho + 4);
  const colunas = Math.max(cabecalho.length, ...amostras.map((l) => l.length));
  const faltas = faltasDaAba(atual);
  const novoCartao = `novo:${aba.nome}`;

  const mudarDestino = (coluna: number, destino: Destino) => {
    const destinos = atual.destinos.map((d, i) =>
      i === coluna ? destino : d === destino && destino !== 'ignorar' ? 'ignorar' : d,
    );
    while (destinos.length <= coluna) destinos.push('ignorar');
    destinos[coluna] = destino;
    onConfig(abaAtual, {
      destinos,
      detectadas: atual.detectadas.map((d, i) => (i === coluna ? false : d)),
      cartaoDaAba: destinos.includes('cartao') ? null : (atual.cartaoDaAba ?? aba.nome),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">Abas da planilha</caption>
          <thead>
            <tr className="h-9 bg-soft text-left text-xs text-ink-muted-on-tint">
              <th scope="col" className="px-4 font-medium">
                Aba da planilha
              </th>
              <th scope="col" className="w-32 px-4 font-medium">
                Linhas
              </th>
              <th scope="col" className="w-52 px-4 font-medium">
                Importar como
              </th>
            </tr>
          </thead>
          <tbody>
            {planilha.abas.map((a, i) => {
              const c = config[i];
              return (
                <tr
                  key={a.nome}
                  aria-selected={i === abaAtual}
                  onClick={() => {
                    onAbaAtual(i);
                  }}
                  className={cn(
                    'h-12 cursor-pointer border-t',
                    i === abaAtual ? 'bg-brand-subtle' : 'hover:bg-soft',
                  )}
                >
                  <td className="px-4 font-medium">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => {
                        onAbaAtual(i);
                      }}
                    >
                      {a.nome}
                    </button>
                  </td>
                  <td className="px-4 text-ink-muted tabular-nums">
                    {Math.max(a.linhas.length - (c?.cabecalho ?? 0) - 1, 0)} linhas
                  </td>
                  <td
                    className="px-4"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Select
                      value={c?.importar ? 'compras' : 'ignorar'}
                      onValueChange={(v) => {
                        onConfig(i, { importar: v === 'compras' });
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Importar a aba ${a.nome} como`}
                        className="h-8 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compras">Compras</SelectItem>
                        <SelectItem value="ignorar">Ignorar</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="colunas-da-aba" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="colunas-da-aba" className="text-base font-semibold">
            Colunas da aba “{aba.nome}”
          </h2>
          <span
            className={cn(
              'flex items-center gap-1 text-[13px]',
              !atual.importar
                ? 'text-ink-muted'
                : faltas.length > 0
                  ? 'text-warning-text'
                  : 'text-success-text',
            )}
          >
            {atual.importar &&
              (faltas.length > 0 ? (
                <TriangleAlert size={14} strokeWidth={1.75} aria-hidden className="text-warning" />
              ) : (
                <CircleCheck size={14} strokeWidth={1.75} aria-hidden className="text-success" />
              ))}
            {!atual.importar
              ? 'Esta aba não será importada'
              : faltas.length > 0
                ? `Falta escolher: ${faltas.join(', ')}`
                : 'Tudo certo nesta aba'}
          </span>
        </div>

        {!atual.destinos.includes('cartao') && (
          <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <Label htmlFor="cartao-da-aba" className="flex-1 text-sm">
              Sem coluna de cartão: as compras desta aba vão para
            </Label>
            <Select
              value={
                cartoes.find((c) => c.nome === atual.cartaoDaAba)
                  ? (atual.cartaoDaAba ?? '')
                  : novoCartao
              }
              onValueChange={(v) => {
                onConfig(abaAtual, { cartaoDaAba: v === novoCartao ? aba.nome : v });
              }}
            >
              <SelectTrigger id="cartao-da-aba" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cartoes.map((c) => (
                  <SelectItem key={c.id} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
                <SelectItem value={novoCartao}>Novo cartão “{aba.nome}”</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-0 overflow-x-auto rounded-lg border">
          {Array.from({ length: colunas }, (_, i) => {
            const destino = atual.destinos[i] ?? 'ignorar';
            const nome = exibir(cabecalho[i]);
            const titulo = nome === '—' ? `Coluna ${letra(i)}` : `Coluna “${nome}”`;
            return (
              <div
                key={i}
                className="flex w-48 flex-none flex-col gap-2 border-r p-3 last:border-r-0"
              >
                <span className="truncate text-[13px] font-semibold" title={titulo}>
                  {titulo}
                </span>
                <Select
                  value={destino}
                  onValueChange={(v) => {
                    mudarDestino(i, v as Destino);
                  }}
                >
                  <SelectTrigger aria-label={`Destino da ${titulo}`} className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINOS.map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span
                  className={cn(
                    'text-xs font-medium',
                    destino === 'ignorar' ? 'text-ink-muted' : 'text-success-text',
                  )}
                >
                  {destino === 'ignorar'
                    ? 'Ignorada'
                    : atual.detectadas[i]
                      ? 'Detectada'
                      : 'Escolhida'}
                </span>
                {amostras.map((linha, j) => (
                  <span key={j} className="truncate text-xs text-ink-muted tabular-nums">
                    {exibir(linha[i])}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
