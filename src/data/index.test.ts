import { describe, expect, it } from 'vitest';
import { criarRepositorios } from '.';

describe('criarRepositorios', () => {
  it('fora do Tauri usa a memória já com os dados fictícios', async () => {
    const repos = await criarRepositorios();
    expect((await repos.cartoes.listar()).length).toBeGreaterThan(0);
  });
});
