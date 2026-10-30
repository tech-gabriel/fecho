import { Navigate, type RouteObject } from 'react-router';
import { Configuracoes } from '@/features/cadastros/Configuracoes';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Faturas } from '@/features/faturas/Faturas';
import { Lancamentos } from '@/features/lancamentos/Lancamentos';
import { AReceber } from '@/features/receber/AReceber';
import { Assinaturas } from '@/features/assinaturas/Assinaturas';
import { Calendario } from '@/features/calendario/Calendario';
import { Economias } from '@/features/economias/Economias';
import { FecharMes } from '@/features/fechamento/FecharMes';
import { Emprestimos } from '@/features/emprestimos/Emprestimos';
import { Simulador } from '@/features/simulador/Simulador';
import { Relatorio } from '@/features/relatorio/Relatorio';
import { EmBreve } from './EmBreve';
import { AppLayout } from './layout/AppLayout';
import { Raiz } from './layout/Raiz';
import { Importacao } from '@/features/importacao/Importacao';
import { CONFIGURACOES, FECHAR_O_MES, PAGINAS } from './paginas';

const TELAS: Record<string, () => React.ReactNode> = {
  '/': Dashboard,
  '/faturas': Faturas,
  '/lancamentos': Lancamentos,
  '/receber': AReceber,
  '/assinaturas': Assinaturas,
  '/calendario': Calendario,
  '/emprestimos': Emprestimos,
  '/economias': Economias,
  '/simulador': Simulador,
  '/relatorio': Relatorio,
};

export const rotas: RouteObject[] = [
  {
    Component: Raiz,
    children: [
      { path: '/importar', Component: Importacao },
      {
        Component: AppLayout,
        children: [
          ...PAGINAS.map((pagina) => ({
            path: pagina.caminho,
            handle: pagina,
            Component: TELAS[pagina.caminho] ?? EmBreve,
          })),
          { path: CONFIGURACOES.caminho, handle: CONFIGURACOES, Component: Configuracoes },
          { path: FECHAR_O_MES.caminho, handle: FECHAR_O_MES, Component: FecharMes },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
