import {
  type Competencia,
  type DataLocal,
  competenciaDe,
  dataNaCompetencia,
  somarMeses,
} from './competencia';
import { type Centavos, somar } from './money';
import type { ItemDevido } from './receber';

export interface EmprestimoTomado {
  id: number;
  descricao: string;
  valorCentavos: Centavos;
  numParcelas: number;
  valorParcelaCentavos: Centavos;
  dia: number;
  inicio: Competencia;
  data: DataLocal;
}

export interface EmprestimoConcedido {
  id: number;
  terceiroId: number;
  descricao: string;
  valorCentavos: Centavos;
  data: DataLocal;
  prazo: DataLocal;
}

export interface PagamentoDeParcela {
  emprestimoId: number;
  numero: number;
  pagoEm: DataLocal;
}

export type StatusDaParcela = 'paga' | 'atrasada' | 'pendente' | 'prevista';

export interface ParcelaTomada {
  numero: number;
  competencia: Competencia;
  vencimento: DataLocal;
  valor: Centavos;
  status: StatusDaParcela;
  pagoEm: DataLocal | null;
}

export function parcelasDoTomado(
  emprestimo: EmprestimoTomado,
  pagamentos: readonly PagamentoDeParcela[],
  hoje: DataLocal,
): ParcelaTomada[] {
  const atual = competenciaDe(hoje);
  return Array.from({ length: emprestimo.numParcelas }, (_, i) => {
    const numero = i + 1;
    const competencia = somarMeses(emprestimo.inicio, i);
    const vencimento = dataNaCompetencia(competencia, emprestimo.dia);
    const pagoEm =
      pagamentos.find((p) => p.emprestimoId === emprestimo.id && p.numero === numero)?.pagoEm ??
      null;
    const status: StatusDaParcela = pagoEm
      ? 'paga'
      : vencimento < hoje
        ? 'atrasada'
        : competencia <= atual
          ? 'pendente'
          : 'prevista';
    return {
      numero,
      competencia,
      vencimento,
      valor: emprestimo.valorParcelaCentavos,
      status,
      pagoEm,
    };
  });
}

export function resumoDoTomado(emprestimo: EmprestimoTomado, parcelas: readonly ParcelaTomada[]) {
  const totalAPagar = emprestimo.valorParcelaCentavos * emprestimo.numParcelas;
  const abertas = parcelas.filter((p) => p.status !== 'paga');
  return {
    pegou: emprestimo.valorCentavos,
    totalAPagar,
    juros: totalAPagar - emprestimo.valorCentavos,
    faltaPagar: somar(abertas.map((p) => p.valor)),
    pagas: parcelas.length - abertas.length,
    proxima: abertas[0] ?? null,
    quitado: abertas.length === 0,
  };
}

export function parcelasTomadasDoMes(
  tomados: readonly EmprestimoTomado[],
  competencia: Competencia,
): Centavos {
  return somar(
    tomados
      .filter(
        (e) => e.inicio <= competencia && competencia <= somarMeses(e.inicio, e.numParcelas - 1),
      )
      .map((e) => e.valorParcelaCentavos),
  );
}

export const chaveDoEmprestimo = (id: number) => `e:${String(id)}`;

export function itemDoConcedido(emprestimo: EmprestimoConcedido): ItemDevido {
  return {
    chave: chaveDoEmprestimo(emprestimo.id),
    emprestimoId: emprestimo.id,
    compraId: 0,
    numero: 1,
    numParcelas: 1,
    descricao: emprestimo.descricao,
    dataCompra: emprestimo.data,
    cartaoId: 0,
    competencia: competenciaDe(emprestimo.prazo),
    vencimento: emprestimo.prazo,
    valor: emprestimo.valorCentavos,
  };
}
