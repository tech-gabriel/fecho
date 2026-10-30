import { useState } from 'react';
import { Check, Copy, ReceiptText, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Preferencias } from '@/data';
import type { DataLocal } from '@/domain/competencia';
import type { ContaDoMes } from '@/domain/contasFixas';
import type { FaturaDoCartao } from '@/features/faturas/Faturas';
import { dataCurta, quando, SeloDeStatus } from '@/features/faturas/ListaDeCartoes';
import { useAcoesDeCobranca } from '@/features/receber/acoes';
import { faltaNaFatura, type SituacaoDaPessoa } from '@/features/receber/situacoes';
import { formatarMoeda } from '@/lib/formato';

export function ProximosVencimentos({
  faturas,
  situacoes,
  preferencias,
  hoje,
  contas,
  onPagarConta,
}: {
  contas: ContaDoMes[];
  onPagarConta: (item: ContaDoMes) => void;
  faturas: FaturaDoCartao[];
  situacoes: SituacaoDaPessoa[];
  preferencias: Preferencias;
  hoje: DataLocal;
}) {
  const { registrarDeposito, copiarCobranca } = useAcoesDeCobranca(preferencias, hoje);
  const [copiado, setCopiado] = useState<string | null>(null);
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
      {comCompras.length === 0 && contas.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nada vence neste mês.</p>
      ) : (
        <ul className="flex flex-col">
          {comCompras.map((fatura) => {
            const { cartao, competencia } = fatura;
            const pendencias = fatura.pagamento
              ? []
              : faltaNaFatura(situacoes, cartao.id, competencia);
            return (
              <li
                key={cartao.id}
                className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0"
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    style={{ backgroundColor: cartao.cor }}
                    className="h-4 w-6 flex-none rounded-sm"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{cartao.nome}</span>
                    <span className="truncate text-xs text-ink-muted">{quando(fatura, hoje)}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatarMoeda(fatura.resumo.total)}
                  </span>
                  <SeloDeStatus status={fatura.status} />
                </span>
                {pendencias.map(({ terceiro, falta }) => {
                  const chave = `${String(cartao.id)}:${String(terceiro.id)}`;
                  const itens =
                    situacoes
                      .find((s) => s.terceiro.id === terceiro.id)
                      ?.itens.filter(
                        (i) =>
                          i.cartaoId === cartao.id && i.competencia === competencia && i.aberto > 0,
                      ) ?? [];
                  return (
                    <span
                      key={chave}
                      role="status"
                      className="flex items-center gap-2 rounded-md bg-warning-bg px-3 py-2 text-[13px] text-warning-text"
                    >
                      <TriangleAlert
                        size={16}
                        strokeWidth={1.75}
                        aria-hidden
                        className="flex-none text-warning"
                      />
                      <span className="flex-1">
                        Faltam {formatarMoeda(falta)} de {terceiro.nome} para fechar a fatura do{' '}
                        {cartao.nome}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copiarCobranca(
                            terceiro,
                            { valor: falta, cartao: cartao.nome, vencimento: fatura.vencimento },
                            () => {
                              setCopiado(chave);
                              setTimeout(() => {
                                setCopiado(null);
                              }, 2000);
                            },
                          )
                        }
                      >
                        {copiado === chave ? (
                          <Check strokeWidth={1.75} aria-hidden />
                        ) : (
                          <Copy strokeWidth={1.75} aria-hidden />
                        )}
                        {copiado === chave ? 'Copiado' : 'Cobrar'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void registrarDeposito(terceiro, falta, itens)}
                      >
                        Recebi
                      </Button>
                    </span>
                  );
                })}
              </li>
            );
          })}
          {contas.map((item) => (
            <li
              key={`conta-${String(item.conta.id)}`}
              aria-label={item.conta.descricao}
              className="flex items-center gap-3 border-t py-3 first:border-t-0 first:pt-0"
            >
              <ReceiptText
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="w-6 flex-none text-ink-muted"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{item.conta.descricao}</span>
                <span className="truncate text-xs text-ink-muted">
                  Conta fixa · vence {dataCurta(item.vencimento)}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatarMoeda(item.valor)}
              </span>
              <SeloDeStatus status={item.status} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onPagarConta(item);
                }}
              >
                Marcar paga
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
