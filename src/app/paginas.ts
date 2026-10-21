import {
  CalendarDays,
  CreditCard,
  HandCoins,
  Landmark,
  LayoutDashboard,
  List,
  Lock,
  PiggyBank,
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
    caminho: '/emprestimos',
    titulo: 'Meus empréstimos',
    rotulo: 'Empréstimos',
    icone: Landmark,
    legenda: 'O que você pegou emprestado e ainda está pagando',
  },
  { caminho: '/economias', titulo: 'Economias', rotulo: 'Economias', icone: PiggyBank },
  { caminho: '/calendario', titulo: 'Calendário', rotulo: 'Calendário', icone: CalendarDays },
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
