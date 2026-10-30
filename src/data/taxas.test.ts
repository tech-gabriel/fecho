import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarTaxas } from './taxas';

const respostas: Record<string, unknown> = {
  '4389': [{ data: '29/10/2026', valor: '13.65' }],
  '1178': [{ data: '29/10/2026', valor: '13.75' }],
  '195': [{ data: '28/10/2026', dataFim: '28/11/2026', valor: '0.6700' }],
};

function bancoCentral(corpo = respostas) {
  return vi.fn((url: string) => {
    const serie = /sgs\.(\d+)\//.exec(url)?.[1] ?? '';
    return Promise.resolve(Response.json(corpo[serie]));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buscarTaxas', () => {
  it('lê CDI, Selic e poupança com a data mais recente', async () => {
    vi.stubGlobal('fetch', bancoCentral());

    expect(await buscarTaxas()).toEqual({
      cdi: 13.65,
      selic: 13.75,
      poupancaMensal: 0.67,
      data: '2026-10-29',
    });
  });

  it('tenta de novo quando uma série falha uma vez', async () => {
    const banco = bancoCentral();
    let primeira = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('sgs.4389') && primeira) {
          primeira = false;
          return Promise.reject(new DOMException('timeout', 'TimeoutError'));
        }
        return banco(url);
      }),
    );

    expect((await buscarTaxas()).cdi).toBe(13.65);
  });

  it('recusa resposta fora do formato', async () => {
    vi.stubGlobal('fetch', bancoCentral({ ...respostas, '1178': [{ data: 'ontem', valor: 'x' }] }));

    await expect(buscarTaxas()).rejects.toThrow('Resposta inesperada');
  });

  it('repassa a falha de rede', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(buscarTaxas()).rejects.toThrow('Failed to fetch');
  });
});
