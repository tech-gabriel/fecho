import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/inter';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

const temaEscuro = window.matchMedia('(prefers-color-scheme: dark)');
const aplicarTema = () => document.documentElement.classList.toggle('dark', temaEscuro.matches);
aplicarTema();
temaEscuro.addEventListener('change', aplicarTema);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
