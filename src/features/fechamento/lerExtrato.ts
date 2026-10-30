import { detectarCabecalho, detectarColunas, lerLinhas } from '@/domain/importacao';
import { decodificarOfx, lerOfx } from '@/domain/ofx';
import type { LinhaDoBanco } from '@/domain/reconciliacao';
import { lerPlanilha, PlanilhaInvalida } from '@/features/importacao/lerPlanilha';

export interface ExtratoLido {
  nome: string;
  linhas: LinhaDoBanco[];
}

const NECESSARIAS = ['data', 'descricao', 'valor'] as const;

export async function lerExtrato(arquivo: File): Promise<ExtratoLido> {
  if (/\.ofx$/i.test(arquivo.name)) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    return { nome: arquivo.name, linhas: lerOfx(decodificarOfx(bytes)) };
  }
  const planilha = await lerPlanilha(arquivo);
  for (const aba of planilha.abas) {
    const inicio = detectarCabecalho(aba.linhas);
    const destinos = detectarColunas(aba.linhas[inicio] ?? []).map((c) => c.destino);
    if (!NECESSARIAS.every((d) => destinos.includes(d))) continue;
    const linhas = lerLinhas({
      aba: aba.nome,
      inicio,
      linhas: aba.linhas.slice(inicio + 1),
      destinos,
      cartaoDaAba: null,
    }).flatMap((l) =>
      l.data && l.valor !== null ? [{ data: l.data, descricao: l.descricao, valor: l.valor }] : [],
    );
    return { nome: planilha.nome, linhas };
  }
  throw new PlanilhaInvalida('Não achei as colunas de data, descrição e valor nesse arquivo.');
}
