import { Navigate, type RouteObject } from 'react-router';
import { Configuracoes } from '@/features/cadastros/Configuracoes';
import { EmBreve } from './EmBreve';
import { AppLayout } from './layout/AppLayout';
import { CONFIGURACOES, PAGINAS } from './paginas';

export const rotas: RouteObject[] = [
  {
    Component: AppLayout,
    children: [
      ...PAGINAS.map((pagina) => ({ path: pagina.caminho, handle: pagina, Component: EmBreve })),
      { path: CONFIGURACOES.caminho, handle: CONFIGURACOES, Component: Configuracoes },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
