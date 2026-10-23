import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { RepositoriosProvider } from './app/repositorios';
import { rotas } from './app/router';
import { iniciarTema } from './lib/tema';
import '@fontsource-variable/inter';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

iniciarTema();

createRoot(root).render(
  <StrictMode>
    <RepositoriosProvider>
      <RouterProvider router={createHashRouter(rotas)} />
    </RepositoriosProvider>
  </StrictMode>,
);
