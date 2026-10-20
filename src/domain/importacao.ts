import {
  assertDataLocal,
  competenciaDe,
  dataNaCompetencia,
  diaDe,
  somarMeses,
  type DataLocal,
} from './competencia';
import { type Centavos, lerReais } from './money';
import { MAXIMO_DE_PARCELAS } from './parcelas';

export type Celula = string | number | boolean | Date | null | undefined;

export type Destino =
  'data' | 'descricao' | 'valor' | 'cartao' | 'parcela' | 'dono' | 'categoria' | 'ignorar';

export type Dono =
  | { tipo: 'meu' }
  | { tipo: 'recorrente' }
  | { tipo: 'pessoa'; nome: string }
  | { tipo: 'varias'; nomes: string[]; incluiMeu: boolean };

export interface LinhaLida {
  id: string;
  aba: string;
  linha: number;
  data: DataLocal | null;
  descricao: string;
  valor: Centavos | null;
  cartao: string | null;
  parcela: { numero: number; total: number } | null | 'invalida';
  dono: Dono;
  categoria: string | null;
}

export interface CompraImportada {
  chave: string;
  linhas: string[];
  cartao: string;
  descricao: string;
  dataCompra: DataLocal;
  valorTotal: Centavos;
  numParcelas: number;
  dono: Dono;
  categoria: string | null;
}

export type TipoDeProblema =
  'valor' | 'data' | 'parcela' | 'negativo' | 'divisao' | 'valoresDiferentes' | 'cartaoNovo';

export interface Problema {
  tipo: TipoDeProblema;
  chave: string;
  linhas: string[];
}

export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const texto = (celula: Celula) =>
  celula === null || celula === undefined || typeof celula === 'boolean'
    ? ''
    : celula instanceof Date
      ? celula.toISOString()
      : String(celula).trim();

const dois = (n: number) => String(n).padStart(2, '0');

function dataValida(ano: number, mes: number, dia: number): DataLocal | null {
  try {
    return assertDataLocal(`${ano}-${dois(mes)}-${dois(dia)}`);
  } catch {
    return null;
  }
}

const SERIAL_MINIMO = 20_000;
const SERIAL_MAXIMO = 80_000;

export function lerData(celula: Celula): DataLocal | null {
  if (celula instanceof Date) {
    return dataValida(celula.getFullYear(), celula.getMonth() + 1, celula.getDate());
  }
  if (typeof celula === 'number') {
    if (celula < SERIAL_MINIMO || celula > SERIAL_MAXIMO) return null;
    const data = new Date(Date.UTC(1899, 11, 30) + Math.floor(celula) * 86_400_000);
    return dataValida(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate());
  }
  const valor = texto(celula);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(valor);
  if (br) {
    const ano = Number(br[3]);
    return dataValida(ano < 100 ? 2000 + ano : ano, Number(br[2]), Number(br[1]));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return iso ? dataValida(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
}

export function lerValor(celula: Celula): Centavos | null {
  if (typeof celula === 'number') return Number.isFinite(celula) ? Math.round(celula * 100) : null;
  let valor = texto(celula).replace(/R\$/i, '').replace(/\s/g, '');
  let negativo = false;
  if (/^\(.*\)$/.test(valor)) {
    negativo = true;
    valor = valor.slice(1, -1);
  }
  if (valor.startsWith('-')) {
    negativo = true;
    valor = valor.slice(1);
  }
  if (/^\d+\.\d{1,2}$/.test(valor)) valor = valor.replace('.', ',');
  try {
    const centavos = lerReais(valor);
    return negativo ? -centavos : centavos;
  } catch {
    return null;
  }
}

export function lerParcela(celula: Celula): LinhaLida['parcela'] {
  const valor = normalizar(texto(celula));
  if (!valor || /^[-—–]$/.test(valor) || valor === 'a vista') return null;
  const m = /^(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})$/.exec(valor);
  if (!m) return 'invalida';
  const numero = Number(m[1]);
  const total = Number(m[2]);
  if (numero < 1 || numero > total || total > MAXIMO_DE_PARCELAS) return 'invalida';
  return total === 1 ? null : { numero, total };
}

const PALAVRAS_DE_MEU = new Set([
  '',
  'eu',
  'meu',
  'minha',
  'mim',
  'eu mesmo',
  'propria',
  'proprio',
]);

export function lerDono(celula: Celula): Dono {
  const original = texto(celula);
  const valor = normalizar(original);
  if (PALAVRAS_DE_MEU.has(valor)) return { tipo: 'meu' };
  if (valor === 'recorrente') return { tipo: 'recorrente' };
  const partes = original
    .split(/\s*(?:\/|,|\+|\be\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length <= 1) return { tipo: 'pessoa', nome: original };
  const incluiMeu = partes.some((p) => PALAVRAS_DE_MEU.has(normalizar(p)));
  const nomes = partes.filter((p) => !PALAVRAS_DE_MEU.has(normalizar(p)));
  return { tipo: 'varias', nomes, incluiMeu };
}

const SINONIMOS: [Exclude<Destino, 'ignorar'>, string[]][] = [
  ['data', ['data', 'dia', 'data da compra', 'quando']],
  ['descricao', ['descricao', 'historico', 'item', 'compra', 'estabelecimento', 'lancamento']],
  ['valor', ['valor', 'preco', 'quantia', 'valor da parcela', 'valor parcela', 'r$']],
  ['cartao', ['cartao', 'cartao de credito', 'card']],
  ['parcela', ['parc', 'parc.', 'parcela', 'parcelas', 'prestacao']],
  ['dono', ['quem', 'de quem', 'responsavel', 'pessoa', 'dono']],
  ['categoria', ['categoria', 'grupo', 'tipo']],
];

const destinoDoNome = (nome: Celula) => {
  const chave = normalizar(texto(nome));
  return SINONIMOS.find(([, nomes]) => nomes.includes(chave))?.[0];
};

export function detectarCabecalho(linhas: readonly (readonly Celula[])[]): number {
  const indice = linhas
    .slice(0, 10)
    .findIndex((linha) => linha.filter((c) => destinoDoNome(c) !== undefined).length >= 2);
  return Math.max(indice, 0);
}

export function detectarColunas(
  cabecalho: readonly Celula[],
): { destino: Destino; detectada: boolean }[] {
  const usados = new Set<Destino>();
  return cabecalho.map((nome) => {
    const destino = destinoDoNome(nome);
    if (!destino || usados.has(destino)) return { destino: 'ignorar', detectada: false };
    usados.add(destino);
    return { destino, detectada: true };
  });
}

export function lerLinhas(aba: {
  aba: string;
  inicio: number;
  linhas: readonly (readonly Celula[])[];
  destinos: readonly Destino[];
  cartaoDaAba: string | null;
}): LinhaLida[] {
  return aba.linhas.flatMap((celulas, i) => {
    if (celulas.every((c) => texto(c) === '')) return [];
    const de = (destino: Destino) => {
      const coluna = aba.destinos.indexOf(destino);
      return coluna < 0 ? undefined : celulas[coluna];
    };
    const linha = aba.inicio + i + 1;
    const cartao = texto(de('cartao')) || aba.cartaoDaAba;
    const categoria = texto(de('categoria'));
    return [
      {
        id: `${aba.aba}:${linha}`,
        aba: aba.aba,
        linha,
        data: lerData(de('data')),
        descricao: texto(de('descricao')),
        valor: lerValor(de('valor')),
        cartao,
        parcela: lerParcela(de('parcela')),
        dono: lerDono(de('dono')),
        categoria: categoria || null,
      },
    ];
  });
}

export function agruparCompras(linhas: readonly LinhaLida[]): CompraImportada[] {
  const avulsas: CompraImportada[] = [];
  const grupos = new Map<string, LinhaLida[][]>();

  for (const l of linhas) {
    if (
      l.valor === null ||
      l.valor <= 0 ||
      l.data === null ||
      l.parcela === 'invalida' ||
      !l.cartao
    ) {
      continue;
    }
    if (l.parcela === null) {
      avulsas.push({
        chave: l.id,
        linhas: [l.id],
        cartao: l.cartao,
        descricao: l.descricao,
        dataCompra: l.data,
        valorTotal: l.valor,
        numParcelas: 1,
        dono: l.dono,
        categoria: l.categoria,
      });
      continue;
    }
    const chave = [normalizar(l.descricao), normalizar(l.cartao), l.parcela.total].join('|');
    const subgrupos = grupos.get(chave) ?? [];
    const numero = l.parcela.numero;
    const livre = subgrupos.find((g) =>
      g.every((outra) => outra.parcela !== 'invalida' && outra.parcela?.numero !== numero),
    );
    if (livre) livre.push(l);
    else subgrupos.push([l]);
    grupos.set(chave, subgrupos);
  }

  const parceladas = [...grupos.values()].flat().map((grupo): CompraImportada => {
    const ordenado = [...grupo].sort(
      (a, b) =>
        (a.parcela !== null && a.parcela !== 'invalida' ? a.parcela.numero : 0) -
        (b.parcela !== null && b.parcela !== 'invalida' ? b.parcela.numero : 0),
    );
    const primeira = ordenado[0] as LinhaLida & {
      data: DataLocal;
      valor: Centavos;
      cartao: string;
    };
    const { numero, total } = primeira.parcela as { numero: number; total: number };
    const mesmaData = ordenado.length > 1 && ordenado.every((l) => l.data === primeira.data);
    const dataCompra = mesmaData
      ? primeira.data
      : dataNaCompetencia(
          somarMeses(competenciaDe(primeira.data), -(numero - 1)),
          diaDe(primeira.data),
        );
    return {
      chave: primeira.id,
      linhas: ordenado.map((l) => l.id),
      cartao: primeira.cartao,
      descricao: primeira.descricao,
      dataCompra,
      valorTotal: primeira.valor * total,
      numParcelas: total,
      dono: primeira.dono,
      categoria: primeira.categoria,
    };
  });

  return [...avulsas, ...parceladas];
}

export function problemasDaImportacao(
  linhas: readonly LinhaLida[],
  compras: readonly CompraImportada[],
  cartoesExistentes: readonly string[],
): Problema[] {
  const porLinha = (tipo: TipoDeProblema, l: LinhaLida): Problema => ({
    tipo,
    chave: l.id,
    linhas: [l.id],
  });
  const problemas: Problema[] = [];

  for (const l of linhas) {
    if (l.valor === null) problemas.push(porLinha('valor', l));
    else if (l.valor <= 0) problemas.push(porLinha('negativo', l));
    if (l.data === null) problemas.push(porLinha('data', l));
    if (l.parcela === 'invalida') problemas.push(porLinha('parcela', l));
    if (l.dono.tipo === 'varias') problemas.push(porLinha('divisao', l));
  }

  const valores = new Map(linhas.map((l) => [l.id, l.valor]));
  for (const compra of compras) {
    if (new Set(compra.linhas.map((id) => valores.get(id))).size > 1) {
      problemas.push({ tipo: 'valoresDiferentes', chave: compra.chave, linhas: compra.linhas });
    }
  }

  const existentes = new Set(cartoesExistentes.map(normalizar));
  const novos = new Map<string, string[]>();
  for (const compra of compras) {
    if (existentes.has(normalizar(compra.cartao))) continue;
    novos.set(compra.cartao, [...(novos.get(compra.cartao) ?? []), ...compra.linhas]);
  }
  for (const [nome, ids] of novos) problemas.push({ tipo: 'cartaoNovo', chave: nome, linhas: ids });

  return problemas;
}

export function marcarDuplicadas(
  compras: readonly CompraImportada[],
  existentes: readonly {
    dataCompra: DataLocal;
    cartao: string;
    descricao: string;
    valorTotal: Centavos;
  }[],
): Set<string> {
  const chave = (c: {
    dataCompra: string;
    cartao: string;
    descricao: string;
    valorTotal: number;
  }) => [c.dataCompra, normalizar(c.cartao), normalizar(c.descricao), c.valorTotal].join('|');
  const gravadas = new Set(existentes.map(chave));
  return new Set(compras.filter((c) => gravadas.has(chave(c))).map((c) => c.chave));
}
