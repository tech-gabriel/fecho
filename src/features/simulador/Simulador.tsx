import { useEffect, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useRepositorios } from '@/app/repositorios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { buscarTaxas } from '@/data/taxas';
import { lerReais } from '@/domain/money';
import {
  anualDaPoupanca,
  rendimentoDe,
  simular,
  type Taxas,
  type TipoDeRendimento,
} from '@/domain/simulador';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { EntradaEmReais } from '@/features/cadastros/formularios';
import { entradaDeInteiro, entradaDeTaxa } from '@/lib/entrada';
import { formatarMoeda } from '@/lib/formato';

const TIPOS: [TipoDeRendimento, string][] = [
  ['poupanca', 'Poupança'],
  ['cdi', 'CDI'],
  ['selic', 'Tesouro Selic'],
  ['fixa', 'Taxa fixa'],
];

const porcento = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const dataBr = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

function reais(texto: string): number | null {
  if (!texto.trim()) return 0;
  try {
    return lerReais(texto);
  } catch {
    return null;
  }
}

function numero(texto: string): number | null {
  const valor = Number(texto.trim().replace(',', '.'));
  return texto.trim() && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function Tile({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4">
      <span className="text-[13px] text-ink-muted">{rotulo}</span>
      <span className="text-xl font-semibold tabular-nums">{valor}</span>
    </div>
  );
}

export function Simulador() {
  const id = useId();
  const repos = useRepositorios();
  const [taxas, setTaxas] = useState<Taxas | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const { register, control, setValue } = useForm({
    defaultValues: {
      inicial: '',
      mensal: '',
      meses: '12',
      tipo: 'fixa' as TipoDeRendimento,
      percentualDoCdi: '100',
      taxaFixa: '',
    },
  });
  const [inicial, mensal, meses, tipo, percentualDoCdi, taxaFixa] = useWatch({
    control,
    name: ['inicial', 'mensal', 'meses', 'tipo', 'percentualDoCdi', 'taxaFixa'],
  });

  useEffect(() => {
    let montado = true;
    void repos.preferencias.ler().then((p) => {
      if (!montado || !p.taxas) return;
      setTaxas(p.taxas);
      setValue('tipo', 'cdi');
    });
    return () => {
      montado = false;
    };
  }, [repos, setValue]);

  const atualizar = async () => {
    setBuscando(true);
    try {
      const novas = await buscarTaxas();
      await repos.preferencias.gravar({ taxas: novas });
      setTaxas(novas);
      setAviso(null);
    } catch {
      setAviso(
        taxas
          ? `Sem conexão com o Banco Central. Usando as taxas de ${dataBr(taxas.data)}.`
          : 'Sem conexão com o Banco Central. Use a taxa fixa por enquanto.',
      );
    } finally {
      setBuscando(false);
    }
  };

  const valores = {
    inicial: reais(inicial),
    mensal: reais(mensal),
    meses: /^\d{1,3}$/.test(meses.trim()) ? Number(meses) : null,
    percentualDoCdi: numero(percentualDoCdi),
    taxaFixa: tipo === 'fixa' ? numero(taxaFixa) : 0,
  };
  const erros = {
    inicial: valores.inicial === null ? 'Digite um valor como 1.234,56' : undefined,
    mensal: valores.mensal === null ? 'Digite um valor como 1.234,56' : undefined,
    meses: valores.meses === null ? 'Use de 0 a 999 meses' : undefined,
    percentualDoCdi: valores.percentualDoCdi === null ? 'Digite um número, como 100' : undefined,
    taxaFixa:
      valores.taxaFixa === null && taxaFixa.trim() ? 'Digite um número, como 11,5' : undefined,
  };
  const taxa = rendimentoDe(tipo, taxas, valores.percentualDoCdi ?? 100, valores.taxaFixa ?? 0);
  const pronto =
    valores.inicial !== null &&
    valores.mensal !== null &&
    valores.meses !== null &&
    taxa !== null &&
    (tipo !== 'fixa' || valores.taxaFixa !== null) &&
    valores.inicial + valores.mensal > 0;
  const simulacao = pronto
    ? simular({
        inicial: valores.inicial ?? 0,
        mensal: valores.mensal ?? 0,
        taxaAnualPct: taxa,
        meses: valores.meses ?? 0,
        ir: tipo !== 'poupanca',
      })
    : null;
  const comparar = (outro: TipoDeRendimento) => {
    const t = rendimentoDe(outro, taxas, 100, 0);
    if (!pronto || t === null) return null;
    return simular({
      inicial: valores.inicial ?? 0,
      mensal: valores.mensal ?? 0,
      taxaAnualPct: t,
      meses: valores.meses ?? 0,
      ir: outro !== 'poupanca',
    }).liquido;
  };
  const naPoupanca = tipo === 'poupanca' ? null : comparar('poupanca');
  const noCdi = tipo === 'cdi' ? null : comparar('cdi');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3 text-[13px]">
        <span className="flex-1 text-ink-muted">
          {taxas
            ? `Taxas do Banco Central de ${dataBr(taxas.data)} · CDI ${porcento.format(taxas.cdi)}% · Selic ${porcento.format(taxas.selic)}% · Poupança ${porcento.format(anualDaPoupanca(taxas.poupancaMensal))}% ao ano`
            : 'Busque as taxas do Banco Central para simular poupança, CDI e Tesouro Selic. Só isso vai para a internet; seus dados ficam aqui.'}
        </span>
        <Button variant="outline" size="sm" disabled={buscando} onClick={() => void atualizar()}>
          {buscando ? (
            <LoaderCircle strokeWidth={1.75} className="animate-spin" />
          ) : (
            <RefreshCw strokeWidth={1.75} />
          )}
          Atualizar taxas
        </Button>
      </div>
      {aviso && (
        <p
          role="status"
          className="rounded-md bg-warning-bg px-3 py-2 text-[13px] text-warning-text"
        >
          {aviso}
        </p>
      )}

      <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-4">
        <form
          className="flex flex-col gap-4 rounded-lg border bg-surface p-6"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Campo id={`${id}-inicial`} rotulo="Aporte inicial" erro={erros.inicial}>
            <EntradaEmReais
              {...atributosDeErro(`${id}-inicial`, erros.inicial)}
              placeholder="1.000,00"
              {...register('inicial')}
            />
          </Campo>
          <Campo id={`${id}-mensal`} rotulo="Aporte por mês" erro={erros.mensal}>
            <EntradaEmReais
              {...atributosDeErro(`${id}-mensal`, erros.mensal)}
              placeholder="200,00"
              {...register('mensal')}
            />
          </Campo>
          <Campo id={`${id}-meses`} rotulo="Prazo em meses" erro={erros.meses}>
            <Input
              {...atributosDeErro(`${id}-meses`, erros.meses)}
              {...entradaDeInteiro(3)}
              className="tabular-nums"
              {...register('meses')}
            />
          </Campo>
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[13px] leading-[18px] font-medium">Rendimento</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={tipo}
              aria-label="Rendimento"
              className="flex-wrap"
              onValueChange={(valor) => {
                if (valor) setValue('tipo', valor as TipoDeRendimento);
              }}
            >
              {TIPOS.map(([valor, rotulo]) => (
                <ToggleGroupItem
                  key={valor}
                  value={valor}
                  disabled={valor !== 'fixa' && !taxas}
                  className="px-3"
                >
                  {rotulo}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          {tipo === 'cdi' && (
            <Campo id={`${id}-cdi`} rotulo="% do CDI" erro={erros.percentualDoCdi}>
              <Input
                {...atributosDeErro(`${id}-cdi`, erros.percentualDoCdi)}
                {...entradaDeInteiro(3)}
                className="tabular-nums"
                {...register('percentualDoCdi')}
              />
            </Campo>
          )}
          {tipo === 'fixa' && (
            <Campo
              id={`${id}-taxa`}
              rotulo="Taxa ao ano"
              erro={erros.taxaFixa}
              dica="Em %, como 11,5."
            >
              <Input
                {...atributosDeErro(`${id}-taxa`, erros.taxaFixa)}
                {...entradaDeTaxa}
                placeholder="11,5"
                className="tabular-nums"
                {...register('taxaFixa')}
              />
            </Campo>
          )}
        </form>

        <section aria-label="Resultado" className="flex min-w-0 flex-col gap-4">
          {!simulacao ? (
            <p className="rounded-lg border bg-surface py-16 text-center text-sm text-ink-muted">
              Preencha quanto vai investir e a taxa para ver quanto rende.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-4">
                <Tile rotulo="Você investe" valor={formatarMoeda(simulacao.investido)} />
                <Tile rotulo="Rendimento bruto" valor={formatarMoeda(simulacao.rendimento)} />
                <Tile
                  rotulo={
                    simulacao.aliquota > 0
                      ? `Imposto (${porcento.format(simulacao.aliquota)}%)`
                      : 'Imposto'
                  }
                  valor={simulacao.aliquota > 0 ? formatarMoeda(simulacao.imposto) : 'Isento'}
                />
                <Tile rotulo="Você resgata" valor={formatarMoeda(simulacao.liquido)} />
              </div>
              <div aria-hidden className="h-[260px] rounded-lg border bg-surface p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={simulacao.meses}
                    margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                      tickFormatter={(m: number) => `${String(m)}m`}
                    />
                    <YAxis
                      tickFormatter={(v: number) => compacto.format(v / 100)}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
                    />
                    <Area
                      dataKey="saldo"
                      type="monotone"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                    <Area
                      dataKey="investido"
                      type="monotone"
                      stroke="var(--ink-muted)"
                      fill="var(--soft)"
                      fillOpacity={0.6}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {(naPoupanca !== null || noCdi !== null) && (
                <p className="text-[13px] text-ink-muted tabular-nums">
                  O mesmo dinheiro
                  {naPoupanca !== null && ` na poupança: ${formatarMoeda(naPoupanca)}`}
                  {naPoupanca !== null && noCdi !== null && ' ·'}
                  {noCdi !== null && ` em 100% do CDI: ${formatarMoeda(noCdi)}`}
                </p>
              )}
              <p className="text-xs text-ink-muted">
                Simulação. O imposto usa o prazo total; não considera taxas de custódia, IOF nem
                mudança das taxas.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
