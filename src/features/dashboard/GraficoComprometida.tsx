import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Competencia } from '@/domain/competencia';
import { formatarMoeda, mesAbreviado, nomeDoMes } from '@/lib/formato';

export interface MesComprometido {
  competencia: Competencia;
  valor: number;
  percentual: number | null;
}

const porcento = (v: number) => `${Math.round(v)}%`;

export function GraficoComprometida({
  meses,
  limite,
}: {
  meses: MesComprometido[];
  limite: number;
}) {
  const [ativo, setAtivo] = useState(0);
  const semRenda = meses.every((m) => m.percentual === null);
  const dados = meses.map((m) => ({
    mes: mesAbreviado(m.competencia).mes,
    percentual: m.percentual ?? 0,
  }));
  const maior = Math.max(limite, ...dados.map((d) => d.percentual));
  const topo = Math.max(40, Math.ceil((maior + 5) / 10) * 10);
  const destaque = meses[ativo] ?? meses[0];

  return (
    <section
      aria-labelledby="renda-comprometida"
      className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h2 id="renda-comprometida" className="text-base font-semibold">
            Renda comprometida
          </h2>
          <p className="text-xs text-ink-muted">Próximos 6 meses · o que já está lançado</p>
        </div>
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <span aria-hidden className="size-2.5 rounded-sm bg-chart-1" />
          Parcelas
        </span>
      </div>

      {semRenda ? (
        <p className="py-12 text-center text-sm text-ink-muted">
          Cadastre sua renda para ver quanto dela já está comprometido.
        </p>
      ) : (
        <div aria-hidden className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 24, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
              />
              <YAxis
                domain={[0, topo]}
                tickFormatter={porcento}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
              />
              <Tooltip content={() => null} cursor={{ fill: 'var(--soft)' }} />
              <ReferenceLine
                y={limite}
                stroke="var(--border-strong)"
                strokeDasharray="4 4"
                label={{
                  value: `limite ${porcento(limite)}`,
                  position: 'insideTopRight',
                  fill: 'var(--ink-muted)',
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="percentual"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                onMouseEnter={(_, indice) => {
                  setAtivo(indice);
                }}
              >
                <LabelList
                  dataKey="percentual"
                  position="top"
                  formatter={(v) => porcento(Number(v))}
                  fill="var(--ink)"
                  fontSize={12}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {destaque && (
        <p className="border-t pt-3 text-[13px] text-ink-muted tabular-nums">
          <span className="font-semibold text-ink">{nomeDoMes(destaque.competencia)}</span>
          {' · '}
          {formatarMoeda(destaque.valor)}
          {destaque.percentual !== null && ` · ${porcento(destaque.percentual)} da renda`}
        </p>
      )}

      <table className="sr-only">
        <caption>Renda comprometida nos próximos 6 meses</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Parcelas</th>
            <th scope="col">Da renda</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.competencia}>
              <th scope="row">{nomeDoMes(m.competencia)}</th>
              <td>{formatarMoeda(m.valor)}</td>
              <td>{m.percentual === null ? 'sem renda' : porcento(m.percentual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
