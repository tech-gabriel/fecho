import { useState } from 'react';
import { Check, ChevronDown, Copy, HandCoins, Layers, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Cartao, Preferencias } from '@/data';
import { diasEntre, type Competencia, type DataLocal } from '@/domain/competencia';
import type { ItemComSituacao } from '@/domain/receber';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda } from '@/lib/formato';
import { useAcoesDeCobranca } from './acoes';
import { ondeEQuando } from './ListaDePessoas';
import { RegistrarDeposito } from './RegistrarDeposito';
import { Avatar, faltaNaFatura, SeloDoTerceiro, type SituacaoDaPessoa } from './situacoes';

const dataLonga = (data: DataLocal) => `${dataCurta(data)}/${data.slice(0, 4)}`;

function Tile({ rotulo, valor, classe }: { rotulo: string; valor: string; classe?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4">
      <span className="text-[13px] text-ink-muted">{rotulo}</span>
      <span className={cn('text-xl font-bold tabular-nums', classe)}>{valor}</span>
    </div>
  );
}

export function DetalheDaPessoa({
  situacao,
  cartoes,
  preferencias,
  competencia,
  hoje,
}: {
  situacao: SituacaoDaPessoa;
  cartoes: Cartao[];
  preferencias: Preferencias;
  competencia: Competencia;
  hoje: DataLocal;
}) {
  const [copiado, setCopiado] = useState(false);
  const [outroValor, setOutroValor] = useState(false);
  const { terceiro, falta, credito, prazo, status } = situacao;
  const nome = terceiro.nome;
  const nomeDoCartao = (id: number) => cartoes.find((c) => c.id === id)?.nome ?? '';

  const abertos = situacao.itens
    .filter((i) => i.aberto > 0)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const primeiro = abertos[0];
  const faltaDaFatura =
    primeiro?.emprestimoId !== undefined
      ? primeiro.aberto
      : primeiro
        ? (faltaNaFatura([situacao], primeiro.cartaoId, primeiro.competencia)[0]?.falta ?? 0)
        : 0;
  const onde = (item: ItemComSituacao) =>
    item.emprestimoId === undefined
      ? nomeDoCartao(item.cartaoId)
      : `Devolve até ${dataCurta(item.vencimento)}`;
  const visiveis = situacao.itens
    .filter((i) => i.aberto > 0 || i.competencia === competencia)
    .sort((a, b) => b.dataCompra.localeCompare(a.dataCompra) || b.numero - a.numero);
  const historico = [...situacao.depositos, ...situacao.cobrancas].sort(
    (a, b) => b.data.localeCompare(a.data) || b.id - a.id,
  );

  const { registrarDeposito, copiarCobranca } = useAcoesDeCobranca(preferencias, hoje);

  const registrar = async (valor: number, escolhidos: ItemComSituacao[]) => {
    if (await registrarDeposito(terceiro, valor, escolhidos)) setOutroValor(false);
  };

  const copiar = () =>
    copiarCobranca(
      terceiro,
      { valor: falta, cartao: primeiro ? onde(primeiro) : '', vencimento: prazo },
      () => {
        setCopiado(true);
        setTimeout(() => {
          setCopiado(false);
        }, 2000);
      },
    );

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-4 rounded-lg border bg-surface p-6">
        <div className="flex items-center gap-4">
          <Avatar nome={nome} tamanho={40} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate text-xl font-semibold">{nome}</h2>
            <p className="truncate text-sm text-ink-muted">
              {primeiro?.emprestimoId !== undefined && prazo
                ? `Devolve o empréstimo até ${dataCurta(prazo)}`
                : prazo
                  ? `Deposita ${ondeEQuando(situacao, cartoes)}`
                  : ondeEQuando(situacao, cartoes)}
            </p>
          </div>
          {falta > 0 && (
            <Button variant="outline" onClick={() => void copiar()}>
              {copiado ? (
                <Check strokeWidth={1.75} aria-hidden />
              ) : (
                <Copy strokeWidth={1.75} aria-hidden />
              )}
              {copiado ? 'Copiado' : 'Copiar cobrança'}
            </Button>
          )}
          <div className="flex">
            <Button
              className="rounded-r-none"
              disabled={falta === 0}
              onClick={() => void registrar(falta, abertos)}
            >
              {falta > 0 ? `Recebi ${formatarMoeda(falta)}` : 'Recebi'}
            </Button>
            <Popover open={outroValor} onOpenChange={setOutroValor}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  aria-label="Outro valor"
                  className="rounded-l-none border-l border-on-brand/20"
                >
                  <ChevronDown strokeWidth={1.75} aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <RegistrarDeposito
                  nome={nome}
                  falta={falta}
                  abertos={abertos}
                  onRegistrar={(valor, escolhidos) => void registrar(valor, escolhidos)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Tile rotulo="Total" valor={formatarMoeda(situacao.total)} />
          <Tile
            rotulo="Já depositou"
            valor={formatarMoeda(situacao.depositado)}
            classe="text-success-text"
          />
          {credito > 0 ? (
            <Tile rotulo="Crédito" valor={formatarMoeda(credito)} classe="text-info-text" />
          ) : (
            <Tile rotulo="Falta" valor={formatarMoeda(falta)} />
          )}
        </div>

        {primeiro && faltaDaFatura > 0 && (
          <p
            role="status"
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-[13px]',
              status === 'atrasado'
                ? 'bg-danger-bg text-danger-text'
                : 'bg-warning-bg text-warning-text',
            )}
          >
            <TriangleAlert
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className={cn('flex-none', status === 'atrasado' ? 'text-danger' : 'text-warning')}
            />
            {primeiro.emprestimoId === undefined ? (
              <>
                Faltam {formatarMoeda(faltaDaFatura)} de {nome} para fechar a fatura do{' '}
                {nomeDoCartao(primeiro.cartaoId)}
                {status === 'atrasado' ? `, que venceu em ${dataCurta(primeiro.vencimento)}.` : '.'}
              </>
            ) : (
              <>
                {nome} combinou devolver {formatarMoeda(faltaDaFatura)} do empréstimo até{' '}
                {dataCurta(primeiro.vencimento)}
                {diasEntre(primeiro.vencimento, hoje) > 0
                  ? `. Já são ${String(diasEntre(primeiro.vencimento, hoje))} dias de atraso.`
                  : '.'}
              </>
            )}
          </p>
        )}
      </div>

      <section aria-labelledby="o-que-deve" className="flex flex-col gap-3">
        <h2 id="o-que-deve" className="text-base font-semibold">
          O que {nome} deve
        </h2>
        <div className="overflow-hidden rounded-lg border bg-surface">
          <table className="w-full table-fixed text-[13px] leading-[18px] font-medium">
            <thead>
              <tr className="h-9 text-left text-xs text-ink-muted">
                <th scope="col" className="w-[92px] pl-4 font-medium">
                  Data
                </th>
                <th scope="col" className="px-3 font-medium">
                  Descrição
                </th>
                <th scope="col" className="w-36 px-3 font-medium">
                  Onde
                </th>
                <th scope="col" className="w-28 px-3 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="w-28 pr-4 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={5} className="h-16 text-center font-normal text-ink-muted">
                    Nada em aberto.
                  </td>
                </tr>
              ) : (
                visiveis.map((item) => (
                  <tr key={item.chave} className="h-10 border-t hover:bg-soft">
                    <td className="pl-4 text-ink-muted tabular-nums">
                      {dataLonga(item.dataCompra)}
                    </td>
                    <td className="px-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{item.descricao}</span>
                        {item.numParcelas > 1 && (
                          <span className="flex flex-none items-center gap-1 text-xs text-ink-muted tabular-nums">
                            <Layers size={12} strokeWidth={1.75} aria-hidden />
                            {item.numero}/{item.numParcelas}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="truncate px-3 font-normal text-ink-muted">{onde(item)}</td>
                    <td className="px-3 text-right tabular-nums">{formatarMoeda(item.valor)}</td>
                    <td className="pr-4">
                      <SeloDoTerceiro status={item.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {historico.length > 0 && (
        <section aria-labelledby="historico" className="flex flex-col gap-3">
          <h2 id="historico" className="text-base font-semibold">
            Histórico
          </h2>
          <ol className="flex flex-col rounded-lg border bg-surface px-4 py-2">
            {historico.map((m) => (
              <li key={m.id} className="flex h-10 items-center gap-3 text-[13px]">
                {m.tipo === 'deposito' ? (
                  <HandCoins size={16} strokeWidth={1.75} aria-hidden className="text-success" />
                ) : (
                  <Copy size={16} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
                )}
                <span className="flex-1">
                  {m.tipo === 'deposito'
                    ? `Depositou ${formatarMoeda(m.valorCentavos)}`
                    : `Cobrança copiada · ${formatarMoeda(m.valorCentavos)}`}
                </span>
                <span className="text-xs text-ink-muted tabular-nums">{dataLonga(m.data)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
