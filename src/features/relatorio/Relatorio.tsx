import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Categoria, ParcelaDoMes } from '@/data';
import { salvarPlanilha } from '@/data/backup';
import type { Competencia } from '@/domain/competencia';
import {
  abasDoRelatorio,
  MESES_CURTOS,
  relatorioDoAno,
  type VisaoDoRelatorio,
} from '@/domain/relatorio';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { iconeDaCategoria } from '@/features/cadastros/opcoes';
import { gerarPlanilhaDeValores } from '@/features/exportacao/gerarPlanilha';
import { formatarMoeda } from '@/lib/formato';

const VISOES: [VisaoDoRelatorio, string][] = [
  ['meu', 'Meu'],
  ['terceiros', 'Terceiros'],
  ['todos', 'Todos'],
];

const MESES_POR_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

interface Dados {
  ano: number;
  meses: { competencia: Competencia; parcelas: ParcelaDoMes[] }[];
  categorias: Categoria[];
}

const celula = (centavos: number) => (centavos === 0 ? '—' : formatarMoeda(centavos));

function Tile({
  rotulo,
  valor,
  legenda,
}: {
  rotulo: string;
  valor: string;
  legenda?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4">
      <span className="text-[13px] text-ink-muted">{rotulo}</span>
      <span className="text-xl font-semibold tabular-nums">{valor}</span>
      {legenda && <span className="text-xs text-ink-muted">{legenda}</span>}
    </div>
  );
}

export function Relatorio() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const [ano, setAno] = useState(() => Number(competencia.slice(0, 4)));
  const [visao, setVisao] = useState<VisaoDoRelatorio>('meu');
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    let montado = true;
    const competencias = MESES_CURTOS.map(
      (_, i) => `${String(ano)}-${String(i + 1).padStart(2, '0')}`,
    );
    void Promise.all([
      Promise.all(competencias.map((c) => repos.compras.parcelasDaCompetencia(c))),
      repos.categorias.listar(),
    ]).then(([parcelas, categorias]) => {
      if (!montado) return;
      setDados({
        ano,
        meses: competencias.map((c, i) => ({ competencia: c, parcelas: parcelas[i] ?? [] })),
        categorias,
      });
    });
    return () => {
      montado = false;
    };
  }, [repos, ano, versao]);

  if (!dados) return null;

  const nomeDaCategoria = (id: number | null) =>
    dados.categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria';
  const { linhas, totaisPorMes, total } = relatorioDoAno(dados.meses, visao);
  const comGasto = totaisPorMes.filter((v) => v > 0);
  const maior = Math.max(...totaisPorMes);
  const mesMaisCaro = totaisPorMes.indexOf(maior);

  const exportar = () =>
    executar(async () => {
      const bytes = await gerarPlanilhaDeValores(abasDoRelatorio(dados.meses, nomeDaCategoria));
      const salvo = await salvarPlanilha(`fecho-relatorio-${String(dados.ano)}.xlsx`, bytes);
      if (salvo) toast.success(`Relatório de ${String(dados.ano)} exportado`);
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ano anterior"
            onClick={() => {
              setAno((a) => a - 1);
            }}
          >
            <ChevronLeft strokeWidth={1.75} />
          </Button>
          <span
            className="w-12 text-center text-base font-semibold tabular-nums"
            aria-live="polite"
          >
            {ano}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo ano"
            onClick={() => {
              setAno((a) => a + 1);
            }}
          >
            <ChevronRight strokeWidth={1.75} />
          </Button>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={visao}
          aria-label="Mostrar"
          onValueChange={(valor) => {
            if (valor) setVisao(valor as VisaoDoRelatorio);
          }}
        >
          {VISOES.map(([valor, rotulo]) => (
            <ToggleGroupItem key={valor} value={valor} className="px-3">
              {rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          variant="outline"
          className="ml-auto"
          aria-label="Exportar .xlsx"
          disabled={dados.meses.every((m) => m.parcelas.length === 0)}
          onClick={() => void exportar()}
        >
          <FileSpreadsheet strokeWidth={1.75} />
          Exportar
        </Button>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border bg-surface py-16 text-center text-sm text-ink-muted">
          Nada lançado em {dados.ano}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Tile rotulo="Total do ano" valor={formatarMoeda(total)} />
            <Tile
              rotulo="Média por mês"
              valor={formatarMoeda(Math.round(total / Math.max(comGasto.length, 1)))}
              legenda={`${String(comGasto.length)} ${comGasto.length === 1 ? 'mês' : 'meses'} com gastos`}
            />
            <Tile
              rotulo="Mês mais caro"
              valor={formatarMoeda(maior)}
              legenda={MESES_POR_EXTENSO[mesMaisCaro]}
            />
          </div>

          <section aria-hidden className="h-[220px] rounded-lg border bg-surface p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={MESES_CURTOS.map((mes, i) => ({ mes, valor: totaisPorMes[i] ?? 0 }))}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v: number) => compacto.format(v / 100)}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                />
                <Bar dataKey="valor" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <div className="overflow-x-auto rounded-lg border bg-surface">
            <table className="w-full min-w-[1080px] text-[13px] tabular-nums">
              <caption className="sr-only">
                Gastos de {dados.ano} por categoria e mês ({VISOES.find(([v]) => v === visao)?.[1]})
              </caption>
              <thead>
                <tr className="h-10 text-left text-xs text-ink-muted">
                  <th scope="col" className="pl-4 font-medium">
                    Categoria
                  </th>
                  {MESES_CURTOS.map((mes) => (
                    <th key={mes} scope="col" className="px-2 text-right font-medium">
                      {mes}
                    </th>
                  ))}
                  <th scope="col" className="pr-4 pl-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const categoria = dados.categorias.find((c) => c.id === l.categoriaId);
                  const Icone = iconeDaCategoria(categoria?.icone ?? 'tag');
                  return (
                    <tr key={l.categoriaId ?? 'sem'} className="h-10 border-t">
                      <th scope="row" className="pl-4 text-left font-medium">
                        <span className="flex items-center gap-2">
                          <Icone
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden
                            className="flex-none text-ink-muted"
                          />
                          {nomeDaCategoria(l.categoriaId)}
                        </span>
                      </th>
                      {l.porMes.map((v, i) => (
                        <td
                          key={MESES_CURTOS[i]}
                          className={v === 0 ? 'px-2 text-right text-ink-muted' : 'px-2 text-right'}
                        >
                          {celula(v)}
                        </td>
                      ))}
                      <td className="pr-4 pl-2 text-right font-semibold">
                        {formatarMoeda(l.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="h-10 border-t bg-soft font-semibold">
                  <th scope="row" className="pl-4 text-left">
                    Total
                  </th>
                  {totaisPorMes.map((v, i) => (
                    <td key={MESES_CURTOS[i]} className="px-2 text-right">
                      {celula(v)}
                    </td>
                  ))}
                  <td className="pr-4 pl-2 text-right">{formatarMoeda(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
