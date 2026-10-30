import type { Taxas } from '@/domain/simulador';

const SERIES = { cdi: 4389, selic: 1178, poupancaMensal: 195 } as const;
const TEMPO_LIMITE = 10_000;

async function ultimoValor(serie: number): Promise<{ valor: number; data: string }> {
  const resposta = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${String(serie)}/dados/ultimos/1?formato=json`,
    { signal: AbortSignal.timeout(TEMPO_LIMITE) },
  );
  if (!resposta.ok) throw new Error(`Banco Central respondeu ${String(resposta.status)}`);
  const [ultimo] = (await resposta.json()) as { data?: unknown; valor?: unknown }[];
  const valor = Number(ultimo?.valor);
  const data = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(ultimo?.data));
  if (!Number.isFinite(valor) || valor <= 0 || !data) throw new Error('Resposta inesperada');
  return { valor, data: `${data[3] ?? ''}-${data[2] ?? ''}-${data[1] ?? ''}` };
}

// a API do Banco Central às vezes deixa a primeira conexão pendurada
const comNovaTentativa = (serie: number) => ultimoValor(serie).catch(() => ultimoValor(serie));

export async function buscarTaxas(): Promise<Taxas> {
  const [cdi, selic, poupanca] = await Promise.all([
    comNovaTentativa(SERIES.cdi),
    comNovaTentativa(SERIES.selic),
    comNovaTentativa(SERIES.poupancaMensal),
  ]);
  return {
    cdi: cdi.valor,
    selic: selic.valor,
    poupancaMensal: poupanca.valor,
    data: [cdi.data, selic.data, poupanca.data].sort().at(-1) ?? cdi.data,
  };
}
