import { Navigate, type RouteObject } from 'react-router';
import { Configuracoes } from '@/features/cadastros/Configuracoes';
import { Faturas } from '@/features/faturas/Faturas';
import { EmBreve } from './EmBreve';
import { AppLayout } from './layout/AppLayout';
import { CONFIGURACOES, PAGINAS } from './paginas';

export const rotas: RouteObject[] = [
  {
    Component: AppLayout,
    children: [
      ...PAGINAS.map((pagina) => ({
        path: pagina.caminho,
        handle: pagina,
        Component: pagina.caminho === '/faturas' ? Faturas : EmBreve,
      })),
      { path: CONFIGURACOES.caminho, handle: CONFIGURACOES, Component: Configuracoes },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
