import { type DataLocal, diasEntre } from './competencia';
import { normalizar } from './importacao';
import { type Centavos, somar } from './money';

export interface LinhaDoFecho {
  id: string;
  compraId: number;
  data: DataLocal;
  descricao: string;
  valor: Centavos;
  aVista: boolean;
}

export interface LinhaDoBanco {
  data: DataLocal;
  descricao: string;
  valor: Centavos;
}

const DIAS_DE_TOLERANCIA = 3;

const palavras = (descricao: string) =>
  new Set(
    normalizar(descricao)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4),
  );

export function reconciliar(fecho: readonly LinhaDoFecho[], banco: readonly LinhaDoBanco[]) {
  const doBanco = banco.filter((l) => l.valor > 0);
  const usadas = new Set<number>();
  const perto = (a: DataLocal, b: DataLocal) => Math.abs(diasEntre(a, b)) <= DIAS_DE_TOLERANCIA;

  const casar = (linha: LinhaDoFecho, aceita: (b: LinhaDoBanco) => boolean) => {
    let melhor = -1;
    doBanco.forEach((b, i) => {
      if (usadas.has(i) || !perto(linha.data, b.data) || !aceita(b)) return;
      const atual = doBanco[melhor];
      if (
        !atual ||
        Math.abs(diasEntre(linha.data, b.data)) < Math.abs(diasEntre(linha.data, atual.data))
      ) {
        melhor = i;
      }
    });
    if (melhor < 0) return null;
    usadas.add(melhor);
    return doBanco[melhor] ?? null;
  };

  const ordenadas = [...fecho].sort((a, b) => a.data.localeCompare(b.data));
  const iguais: { fecho: LinhaDoFecho; banco: LinhaDoBanco }[] = [];
  const restantes: LinhaDoFecho[] = [];
  for (const linha of ordenadas) {
    const par = casar(linha, (b) => b.valor === linha.valor);
    if (par) iguais.push({ fecho: linha, banco: par });
    else restantes.push(linha);
  }

  const diferentes: { fecho: LinhaDoFecho; banco: LinhaDoBanco }[] = [];
  const soNoFecho: LinhaDoFecho[] = [];
  for (const linha of restantes) {
    const chaves = palavras(linha.descricao);
    const par = casar(linha, (b) => [...palavras(b.descricao)].some((p) => chaves.has(p)));
    if (par) diferentes.push({ fecho: linha, banco: par });
    else soNoFecho.push(linha);
  }

  return {
    iguais,
    diferentes,
    soNoFecho,
    soNoBanco: doBanco.filter((_, i) => !usadas.has(i)),
    totalFecho: somar(fecho.map((l) => l.valor)),
    totalBanco: somar(doBanco.map((l) => l.valor)),
  };
}
