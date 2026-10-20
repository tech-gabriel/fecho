import { Navigate, type RouteObject } from 'react-router';
import { EmBreve } from './EmBreve';
import { AppLayout } from './layout/AppLayout';
import { CONFIGURACOES, PAGINAS } from './paginas';

export const rotas: RouteObject[] = [
  {
    Component: AppLayout,
    children: [
      ...[...PAGINAS, CONFIGURACOES].map((pagina) => ({
        path: pagina.caminho,
        handle: pagina,
        Component: EmBreve,
      })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
