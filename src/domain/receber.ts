import type { Competencia, DataLocal } from './competencia';
import { type DiasDoCartao, datasDaFatura } from './faturas';
import type { Centavos } from './money';
import { type Rateio, ratear, type StatusTerceiro, statusTerceiro } from './terceiros';

export interface ItemDevido {
  emprestimoId?: number;
  contaFixaId?: number;
  chave: string;
  compraId: number;
  numero: number;
  numParcelas: number;
  descricao: string;
  dataCompra: DataLocal;
  cartaoId: number;
  competencia: Competencia;
  vencimento: DataLocal;
  valor: Centavos;
}

export type Abatimento =
  | { compraId: number; numero: number; valor: Centavos }
  | { emprestimoId: number; valor: Centavos }
  | { contaFixaId: number; competencia: Competencia; valor: Centavos };

export const chaveDaConta = (contaFixaId: number, competencia: Competencia) =>
  `f:${String(contaFixaId)}:${competencia}`;

const chaveDoAbatimento = (a: Abatimento) =>
  'emprestimoId' in a
    ? `e:${String(a.emprestimoId)}`
    : 'contaFixaId' in a
      ? chaveDaConta(a.contaFixaId, a.competencia)
      : chaveDoItem(a.compraId, a.numero);

export interface DepositoDaPessoa {
  valor: Centavos;
  abatimentos: readonly Abatimento[];
}

export type StatusDoItem = StatusTerceiro;

export interface ItemComSituacao extends ItemDevido {
  abatido: Centavos;
  aberto: Centavos;
  status: StatusDoItem;
}

export const chaveDoItem = (compraId: number, numero: number) => `${compraId}:${numero}`;

export function itensDaPessoa(
  parcelas: readonly {
    compraId: number;
    numero: number;
    numParcelas: number;
    descricao: string;
    dataCompra: DataLocal;
    cartaoId: number;
    competencia: Competencia;
    valorCentavos: Centavos;
    rateios: readonly Rateio[];
  }[],
  terceiroId: number,
  cartoes: readonly ({ id: number } & DiasDoCartao)[],
): ItemDevido[] {
  return parcelas.flatMap((p) => {
    const valor = ratear(p.valorCentavos, p.rateios).porTerceiro.get(terceiroId) ?? 0;
    const cartao = cartoes.find((c) => c.id === p.cartaoId);
    if (valor <= 0 || !cartao) return [];
    return [
      {
        chave: chaveDoItem(p.compraId, p.numero),
        compraId: p.compraId,
        numero: p.numero,
        numParcelas: p.numParcelas,
        descricao: p.descricao,
        dataCompra: p.dataCompra,
        cartaoId: p.cartaoId,
        competencia: p.competencia,
        vencimento: datasDaFatura(p.competencia, cartao).vencimento,
        valor,
      },
    ];
  });
}

export function situacaoDaPessoa(
  itens: readonly ItemDevido[],
  depositos: readonly DepositoDaPessoa[],
  hoje: DataLocal,
) {
  const abatidoPorItem = new Map<string, Centavos>();
  for (const { abatimentos } of depositos) {
    for (const a of abatimentos) {
      const chave = chaveDoAbatimento(a);
      abatidoPorItem.set(chave, (abatidoPorItem.get(chave) ?? 0) + a.valor);
    }
  }

  const comSituacao: ItemComSituacao[] = itens.map((item) => {
    const abatido = abatidoPorItem.get(item.chave) ?? 0;
    const aberto = Math.max(item.valor - abatido, 0);
    return {
      ...item,
      abatido,
      aberto,
      status: statusTerceiro({
        devido: item.valor,
        depositado: abatido,
        prazo: item.vencimento,
        hoje,
      }),
    };
  });

  const total = itens.reduce((s, i) => s + i.valor, 0);
  const depositado = depositos.reduce((s, d) => s + d.valor, 0);
  const prazo =
    comSituacao
      .filter((i) => i.aberto > 0)
      .map((i) => i.vencimento)
      .sort()[0] ?? null;

  return {
    total,
    depositado,
    falta: Math.max(total - depositado, 0),
    credito: Math.max(depositado - total, 0),
    prazo,
    status: statusTerceiro({ devido: total, depositado, prazo, hoje }),
    itens: comSituacao,
  };
}

interface Aberto {
  chave: string;
  emprestimoId?: number | undefined;
  contaFixaId?: number | undefined;
  competencia?: Competencia;
  compraId: number;
  numero: number;
  vencimento: DataLocal;
  aberto: Centavos;
}

const porVencimento = (a: Aberto, b: Aberto) =>
  a.vencimento.localeCompare(b.vencimento) || a.chave.localeCompare(b.chave);

export function sugerirAbatimento(abertos: readonly Aberto[], valor: Centavos): string[] {
  const escolhidos: string[] = [];
  let coberto = 0;
  for (const item of [...abertos].sort(porVencimento)) {
    if (coberto >= valor) break;
    escolhidos.push(item.chave);
    coberto += item.aberto;
  }
  return escolhidos;
}

export function distribuir(
  valor: Centavos,
  escolhidos: readonly Aberto[],
): { abatimentos: Abatimento[]; sobra: Centavos } {
  let restante = valor;
  const abatimentos: Abatimento[] = [];
  for (const item of [...escolhidos].sort(porVencimento)) {
    if (restante <= 0) break;
    const parte = Math.min(restante, item.aberto);
    if (parte > 0) {
      abatimentos.push(
        item.emprestimoId !== undefined
          ? { emprestimoId: item.emprestimoId, valor: parte }
          : item.contaFixaId !== undefined && item.competencia !== undefined
            ? { contaFixaId: item.contaFixaId, competencia: item.competencia, valor: parte }
            : { compraId: item.compraId, numero: item.numero, valor: parte },
      );
    }
    restante -= parte;
  }
  return { abatimentos, sobra: restante };
}

const MODELO_DE_CONTA =
  'Oi, {nome}! Faltam {valor} da sua parte da conta {conta}, que vence em {vencimento}. Meu Pix: {pix}';

const MODELO_DE_EMPRESTIMO =
  'Oi, {nome}! Faltam {valor} do empréstimo, que combinamos para {vencimento}. Meu Pix: {pix}';

// cartao null = cobrança só de empréstimo; o modelo do usuário fala em compras no cartão
export function mensagemDeCobranca(
  modelo: string,
  variaveis: {
    nome: string;
    valor: string;
    cartao: string | null;
    conta?: string | null | undefined;
    vencimento: string;
    pix: string;
  },
): string {
  const cartao = variaveis.cartao ?? '';
  const base =
    variaveis.cartao !== null ? modelo : variaveis.conta ? MODELO_DE_CONTA : MODELO_DE_EMPRESTIMO;
  return base
    .replaceAll('{conta}', variaveis.conta ?? '')
    .replaceAll('{nome}', variaveis.nome)
    .replaceAll('{valor}', variaveis.valor)
    .replaceAll('{cartão}', cartao)
    .replaceAll('{cartao}', cartao)
    .replaceAll('{vencimento}', variaveis.vencimento)
    .replaceAll('{pix}', variaveis.pix);
}
