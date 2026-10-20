import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('mostra o nome do app e a ação principal', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Fechô' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova compra' })).toBeEnabled();
  });
});
