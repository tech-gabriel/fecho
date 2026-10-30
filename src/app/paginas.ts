import {
  CalendarDays,
  ChartColumn,
  CreditCard,
  HandCoins,
  Landmark,
  LayoutDashboard,
  List,
  Lock,
  PiggyBank,
  ReceiptText,
  Repeat,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useMatches } from 'react-router';

export interface Pagina {
  caminho: string;
  titulo: string;
  rotulo: string;
  icone: LucideIcon;
  legenda?: string;
}

export const PAGINAS: Pagina[] = [
  { caminho: '/', titulo: 'Dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { caminho: '/faturas', titulo: 'Faturas', rotulo: 'Faturas', icone: CreditCard },
  { caminho: '/lancamentos', titulo: 'Lançamentos', rotulo: 'Lançamentos', icone: List },
  {
    caminho: '/receber',
    titulo: 'A receber',
    rotulo: 'A receber',
    icone: HandCoins,
    legenda: 'O que os outros devem para você',
  },
  {
    caminho: '/assinaturas',
    titulo: 'Assinaturas',
    rotulo: 'Assinaturas',
    icone: Repeat,
    legenda: 'Tudo o que se repete todo mês',
  },
  {
    caminho: '/contas',
    titulo: 'Contas fixas',
    rotulo: 'Contas fixas',
    icone: ReceiptText,
    legenda: 'O que você paga todo mês fora do cartão',
  },
  {
    caminho: '/emprestimos',
    titulo: 'Meus empréstimos',
    rotulo: 'Empréstimos',
    icone: Landmark,
    legenda: 'O que você pegou emprestado e ainda está pagando',
  },
  { caminho: '/economias', titulo: 'Economias', rotulo: 'Economias', icone: PiggyBank },
  { caminho: '/calendario', titulo: 'Calendário', rotulo: 'Calendário', icone: CalendarDays },
  {
    caminho: '/relatorio',
    titulo: 'Relatório',
    rotulo: 'Relatório',
    icone: ChartColumn,
    legenda: 'Seus gastos no cartão e nas contas fixas, mês a mês',
  },
];

export const CONFIGURACOES: Pagina = {
  caminho: '/configuracoes',
  titulo: 'Configurações',
  rotulo: 'Configurações',
  icone: Settings,
  legenda: 'Tudo fica salvo só neste computador',
};

export const FECHAR_O_MES: Pagina = {
  caminho: '/fechar/:competencia',
  titulo: 'Fechar o mês',
  rotulo: 'Fechar o mês',
  icone: Lock,
};

export function usePaginaAtual(): Pagina | undefined {
  return useMatches().at(-1)?.handle as Pagina | undefined;
}
