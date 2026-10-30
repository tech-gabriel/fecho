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
  parcelas: number;
  assinaturas: number;
  contas: number;
  emprestimos: number;
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
  const dados = meses.map((m) => {
    const percentual = m.percentual ?? 0;
    const daParte = (parte: number) => (m.valor > 0 ? (percentual * parte) / m.valor : 0);
    return {
      mes: mesAbreviado(m.competencia).mes,
      percentual,
      parcelas: daParte(m.parcelas),
      assinaturas: daParte(m.assinaturas),
      contas: daParte(m.contas),
      emprestimos: daParte(m.emprestimos),
    };
  });
  const maior = Math.max(limite, ...dados.map((d) => d.percentual));
  const topo = Math.max(40, Math.ceil((maior + 5) / 10) * 10);
  const destaque = meses[ativo] ?? meses[0];

  return (
    <section
      aria-labelledby="renda-comprometida"
      className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <h2 id="renda-comprometida" className="text-base font-semibold">
            Renda comprometida
          </h2>
          <p className="text-xs text-ink-muted">
            Próximos 6 meses · o que já está lançado · limite {porcento(limite)}
          </p>
        </div>
        <span className="flex items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm bg-chart-1" />
            Parcelas
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm bg-chart-3" />
            Assinaturas
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm bg-chart-4" />
            Contas
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--chart-5)_0_2px,var(--surface)_2px_3px)]"
            />
            Empréstimos
          </span>
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
              <defs>
                <pattern
                  id="hachura-emprestimos"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="var(--chart-5)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--surface)" strokeWidth="2" />
                </pattern>
              </defs>
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
              <ReferenceLine y={limite} stroke="var(--border-strong)" strokeDasharray="4 4" />
              <Bar
                dataKey="parcelas"
                stackId="comprometida"
                fill="var(--chart-1)"
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={40}
                onMouseEnter={(_, indice) => {
                  setAtivo(indice);
                }}
              />
              <Bar
                dataKey="assinaturas"
                stackId="comprometida"
                fill="var(--chart-3)"
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={40}
                onMouseEnter={(_, indice) => {
                  setAtivo(indice);
                }}
              />
              <Bar
                dataKey="contas"
                stackId="comprometida"
                fill="var(--chart-4)"
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={40}
                onMouseEnter={(_, indice) => {
                  setAtivo(indice);
                }}
              />
              <Bar
                dataKey="emprestimos"
                stackId="comprometida"
                fill="url(#hachura-emprestimos)"
                stroke="var(--surface)"
                strokeWidth={2}
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
          <span className="block text-xs">
            Parcelas {formatarMoeda(destaque.parcelas)} · Assinaturas{' '}
            {formatarMoeda(destaque.assinaturas)} · Contas {formatarMoeda(destaque.contas)} ·
            Empréstimos {formatarMoeda(destaque.emprestimos)}
          </span>
        </p>
      )}

      <table className="sr-only">
        <caption>Renda comprometida nos próximos 6 meses</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Parcelas</th>
            <th scope="col">Assinaturas</th>
            <th scope="col">Contas fixas</th>
            <th scope="col">Empréstimos</th>
            <th scope="col">Da renda</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.competencia}>
              <th scope="row">{nomeDoMes(m.competencia)}</th>
              <td>{formatarMoeda(m.parcelas)}</td>
              <td>{formatarMoeda(m.assinaturas)}</td>
              <td>{formatarMoeda(m.contas)}</td>
              <td>{formatarMoeda(m.emprestimos)}</td>
              <td>{m.percentual === null ? 'sem renda' : porcento(m.percentual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
