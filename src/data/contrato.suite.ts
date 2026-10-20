import { beforeEach, describe, expect, it } from 'vitest';
import type { DadosNovaCompra } from '@/domain/compras';
import type { Repositorios } from './repositories';

export function contratoDosRepositorios(nome: string, criar: () => Promise<Repositorios>) {
  describe(`repositórios: ${nome}`, () => {
    let repos: Repositorios;
    let cartaoRoxo: number;
    let ana: number;

    beforeEach(async () => {
      repos = await criar();
      cartaoRoxo = await repos.cartoes.criar({
        nome: 'Cartão Roxo',
        diaFechamento: 28,
        diaVencimento: 5,
        limiteCentavos: 500_000,
        cor: '#8B5CF6',
      });
      ana = await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true });
    });

    const compra = (extra: Partial<DadosNovaCompra> = {}): DadosNovaCompra => ({
      cartaoId: cartaoRoxo,
      descricao: 'Tênis',
      categoriaId: null,
      valorTotal: 64_950,
      numParcelas: 3,
      dataCompra: '2026-10-19',
      recorrente: false,
      rateios: [],
      ...extra,
    });

    describe('cadastros', () => {
      it('cria, lista e atualiza', async () => {
        const azul = await repos.cartoes.criar({
          nome: 'Cartão Azul',
          diaFechamento: 5,
          diaVencimento: 15,
          limiteCentavos: 0,
          cor: '#3B82F6',
        });
        expect(azul).not.toBe(cartaoRoxo);

        await repos.cartoes.atualizar(azul, {
          nome: 'Cartão Azul Black',
          limiteCentavos: 1_000_000,
        });

        expect(await repos.cartoes.listar()).toEqual([
          {
            id: cartaoRoxo,
            nome: 'Cartão Roxo',
            diaFechamento: 28,
            diaVencimento: 5,
            limiteCentavos: 500_000,
            cor: '#8B5CF6',
          },
          {
            id: azul,
            nome: 'Cartão Azul Black',
            diaFechamento: 5,
            diaVencimento: 15,
            limiteCentavos: 1_000_000,
            cor: '#3B82F6',
          },
        ]);
      });

      it('categorias e terceiros seguem o mesmo contrato', async () => {
        const mercado = await repos.categorias.criar({ nome: 'Mercado', icone: 'shopping-cart' });
        await repos.terceiros.atualizar(ana, { ativo: false });

        expect(await repos.categorias.listar()).toEqual([
          { id: mercado, nome: 'Mercado', icone: 'shopping-cart' },
        ]);
        expect(await repos.terceiros.listar()).toEqual([
          { id: ana, nome: 'Ana', cor: '#2563EB', ativo: false },
        ]);
      });

      it('excluir esconde e restaurar devolve', async () => {
        await repos.terceiros.excluir(ana);
        expect(await repos.terceiros.listar()).toEqual([]);

        await repos.terceiros.restaurar(ana);
        expect((await repos.terceiros.listar()).map((t) => t.id)).toEqual([ana]);
      });

      it('recusa id inexistente', async () => {
        await expect(repos.cartoes.atualizar(9999, { nome: 'X' })).rejects.toThrow(
          'não encontrado',
        );
        await expect(repos.cartoes.excluir(9999)).rejects.toThrow('não encontrado');
        await expect(repos.cartoes.restaurar(9999)).rejects.toThrow('não encontrado');
      });
    });

    describe('compras', () => {
      it('salva a compra com parcelas e rateio', async () => {
        const id = await repos.compras.salvar(
          compra({
            rateios: [
              { terceiroId: null, percentual: 50 },
              { terceiroId: ana, percentual: 50 },
            ],
          }),
        );

        const outubro = await repos.compras.parcelasDaCompetencia('2026-10');
        expect(outubro).toEqual([
          {
            parcelaId: expect.any(Number) as number,
            compraId: id,
            numero: 1,
            numParcelas: 3,
            competencia: '2026-10',
            valorCentavos: 21_650,
            descricao: 'Tênis',
            dataCompra: '2026-10-19',
            cartaoId: cartaoRoxo,
            categoriaId: null,
            recorrente: false,
            rateios: [
              { terceiroId: null, percentual: 50 },
              { terceiroId: ana, percentual: 50 },
            ],
          },
        ]);
        expect((await repos.compras.parcelasDaCompetencia('2026-12'))[0]?.numero).toBe(3);
        expect(await repos.compras.parcelasDaCompetencia('2027-01')).toEqual([]);
      });

      it('ordena as parcelas do mês pela data da compra', async () => {
        await repos.compras.salvar(compra({ descricao: 'Segunda', dataCompra: '2026-10-20' }));
        await repos.compras.salvar(compra({ descricao: 'Primeira', dataCompra: '2026-10-02' }));

        const descricoes = (await repos.compras.parcelasDaCompetencia('2026-10')).map(
          (p) => p.descricao,
        );
        expect(descricoes).toEqual(['Primeira', 'Segunda']);
      });

      it('excluir a compra tira as parcelas do mês e restaurar devolve', async () => {
        const id = await repos.compras.salvar(compra());

        await repos.compras.excluir(id);
        expect(await repos.compras.parcelasDaCompetencia('2026-10')).toEqual([]);

        await repos.compras.restaurar(id);
        expect(await repos.compras.parcelasDaCompetencia('2026-10')).toHaveLength(1);
      });

      it('não grava nada quando o domínio recusa a compra', async () => {
        await expect(repos.compras.salvar(compra({ valorTotal: 0 }))).rejects.toThrow(
          'Digite um valor maior que zero',
        );
        expect(await repos.compras.parcelasDaCompetencia('2026-10')).toEqual([]);
      });

      it('recusa compra em cartão excluído ou inexistente', async () => {
        await repos.cartoes.excluir(cartaoRoxo);
        await expect(repos.compras.salvar(compra())).rejects.toThrow('não encontrado');
        await expect(repos.compras.salvar(compra({ cartaoId: 9999 }))).rejects.toThrow(
          'não encontrado',
        );
      });

      it('recusa excluir compra inexistente', async () => {
        await expect(repos.compras.excluir(9999)).rejects.toThrow('não encontrado');
      });
    });
  });
}
