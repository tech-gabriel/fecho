import { CreditCard, Ellipsis, Layers, Repeat, TriangleAlert, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Categoria, PagamentoDeFatura, Terceiro } from '@/data';
import type { DataLocal } from '@/domain/competencia';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import type { FaturaDoCartao, Filtro } from './Faturas';
import { dataCurta, SeloDeStatus } from './ListaDeCartoes';

const FILTROS: [Filtro, string][] = [
  ['meu', 'Meu'],
  ['terceiros', 'Terceiros'],
  ['todos', 'Todos'],
];

const dataLonga = (data: DataLocal) => `${dataCurta(data)}/${data.slice(0, 4)}`;

function Tile({ rotulo, valor, legenda }: { rotulo: string; valor: string; legenda?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4">
      <span className="text-[13px] text-ink-muted">{rotulo}</span>
      <span className="text-xl font-bold tabular-nums">{valor}</span>
      {legenda && <span className="truncate text-xs text-ink-muted">{legenda}</span>}
    </div>
  );
}

export function DetalheDaFatura({
  fatura,
  categorias,
  terceiros,
  filtro,
  hoje,
  onFiltro,
}: {
  fatura: FaturaDoCartao;
  categorias: Categoria[];
  terceiros: Terceiro[];
  filtro: Filtro;
  hoje: DataLocal;
  onFiltro: (filtro: Filtro) => void;
}) {
  const repos = useRepositorios();
  const navigate = useNavigate();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const abrirNovaCompra = useApp((s) => s.abrirNovaCompra);
  const { cartao, resumo, pagamento } = fatura;
  const mes = nomeDoMes(fatura.competencia).split(' ')[0] ?? '';
  const nome = (id: number) => terceiros.find((t) => t.id === id)?.nome ?? '';

  if (fatura.parcelas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-surface text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-soft">
          <CreditCard size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
        </span>
        <p className="text-sm text-ink-muted">
          Nenhuma compra no {cartao.nome} em {mes}.
        </p>
        <Button
          onClick={() => {
            abrirNovaCompra();
          }}
        >
          Registrar compra
        </Button>
      </div>
    );
  }

  const marcar = (dados: PagamentoDeFatura) =>
    executar(async () => {
      await repos.faturas.marcarComoPaga(dados);
      dadosMudaram();
    });
  const desmarcar = () =>
    executar(async () => {
      await repos.faturas.desmarcar(cartao.id, fatura.competencia);
      dadosMudaram();
    });

  const marcarComoPaga = async () => {
    const dados = {
      cartaoId: cartao.id,
      competencia: fatura.competencia,
      pagoEm: hoje,
      valorPagoCentavos: resumo.total,
    };
    await marcar(dados);
    toast.success(`Fatura do ${cartao.nome} marcada como paga`, {
      action: { label: 'Desfazer', onClick: () => void desmarcar() },
    });
  };

  const desmarcarComoPaga = async (anterior: PagamentoDeFatura) => {
    await desmarcar();
    toast.success(`Fatura do ${cartao.nome} voltou a ficar em aberto`, {
      action: { label: 'Desfazer', onClick: () => void marcar(anterior) },
    });
  };

  const limite =
    cartao.limiteCentavos > 0
      ? ` · limite usado ${Math.round((resumo.total / cartao.limiteCentavos) * 100)}% de ${formatarMoeda(cartao.limiteCentavos)}`
      : '';
  const depoisDoPagamento = pagamento ? resumo.total - pagamento.valorPagoCentavos : 0;
  const porPessoa = [...resumo.porTerceiro]
    .map(([id, valor]) => `${nome(id)} ${formatarMoeda(valor)}`)
    .join(' · ');

  const parcela = (id: number) => fatura.parcelas.find((p) => p.parcelaId === id);
  const linhas = fatura.linhas
    .filter((l) => filtro === 'todos' || (filtro === 'meu' ? l.dono === null : l.dono !== null))
    .map((l) => ({ ...l, parcela: parcela(l.parcelaId) }))
    .sort(
      (a, b) =>
        (b.parcela?.dataCompra ?? '').localeCompare(a.parcela?.dataCompra ?? '') ||
        a.parcelaId - b.parcelaId,
    );

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-4 rounded-lg border bg-surface p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            style={{ backgroundColor: cartao.cor }}
            className="h-7 w-10 flex-none rounded-md"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate text-xl font-semibold">{cartao.nome}</h2>
            <p className="text-sm text-ink-muted">
              Fecha {dataCurta(fatura.fechamento)} · Vence {dataCurta(fatura.vencimento)}
              {limite}
            </p>
          </div>
          {pagamento ? (
            <SeloDeStatus status="paga" texto={`Paga em ${dataCurta(pagamento.pagoEm)}`} />
          ) : (
            <Button onClick={() => void marcarComoPaga()}>Marcar como paga</Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações">
                <Ellipsis strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pagamento && (
                <DropdownMenuItem onSelect={() => void desmarcarComoPaga(pagamento)}>
                  Desmarcar como paga
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => void navigate('/configuracoes')}>
                Editar cartão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {pagamento && depoisDoPagamento > 0 && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md bg-warning-bg px-3 py-2 text-[13px] text-warning-text"
          >
            <TriangleAlert
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className="flex-none text-warning"
            />
            {formatarMoeda(depoisDoPagamento)} lançados depois do pagamento em{' '}
            {dataLonga(pagamento.pagoEm)}.
          </p>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Tile rotulo="Total da fatura" valor={formatarMoeda(resumo.total)} />
          <Tile rotulo="É seu" valor={formatarMoeda(resumo.meu)} />
          <Tile
            rotulo="De terceiros"
            valor={formatarMoeda(resumo.total - resumo.meu)}
            legenda={porPessoa || 'Nenhuma compra de outras pessoas'}
          />
        </div>
      </div>

      <section aria-labelledby="compras-da-fatura" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="compras-da-fatura" className="text-base font-semibold">
            Compras da fatura
          </h2>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filtro}
            aria-label="Mostrar"
            onValueChange={(valor) => {
              if (valor) onFiltro(valor as Filtro);
            }}
          >
            {FILTROS.map(([valor, rotulo]) => (
              <ToggleGroupItem
                key={valor}
                value={valor}
                className="px-3 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
              >
                {rotulo}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

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
                <th scope="col" className="w-32 px-3 font-medium">
                  Categoria
                </th>
                <th scope="col" className="w-[120px] px-3 font-medium">
                  De quem
                </th>
                <th scope="col" className="w-28 pr-4 text-right font-medium">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={5} className="h-16 text-center font-normal text-ink-muted">
                    {filtro === 'meu'
                      ? 'Nenhuma compra sua nesta fatura.'
                      : 'Nenhuma compra de outras pessoas nesta fatura.'}
                  </td>
                </tr>
              ) : (
                linhas.map(({ parcelaId, dono, valorCentavos, parcela: p }) => (
                  <tr key={`${parcelaId}-${dono ?? 'meu'}`} className="h-10 border-t hover:bg-soft">
                    <td className="pl-4 text-ink-muted tabular-nums">
                      {p && dataLonga(p.dataCompra)}
                    </td>
                    <td className="px-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{p?.descricao}</span>
                        {p && p.numParcelas > 1 && (
                          <span className="flex flex-none items-center gap-1 text-xs text-ink-muted tabular-nums">
                            <Layers size={12} strokeWidth={1.75} aria-hidden />
                            {p.numero}/{p.numParcelas}
                          </span>
                        )}
                        {p?.recorrente && (
                          <Repeat
                            size={12}
                            strokeWidth={1.75}
                            aria-label="Repete todo mês"
                            className="flex-none text-ink-muted"
                          />
                        )}
                      </span>
                    </td>
                    <td className="truncate px-3 font-normal text-ink-muted">
                      {categorias.find((c) => c.id === p?.categoriaId)?.nome ?? '—'}
                    </td>
                    <td className="px-3">
                      {dono === null ? (
                        <span className="text-ink-muted">Meu</span>
                      ) : (
                        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-info-bg px-2 text-xs font-medium text-info-text">
                          <UserRound
                            size={12}
                            strokeWidth={1.75}
                            aria-hidden
                            className="flex-none"
                          />
                          <span className="truncate">{nome(dono)}</span>
                        </span>
                      )}
                    </td>
                    <td className="pr-4 text-right tabular-nums">{formatarMoeda(valorCentavos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
