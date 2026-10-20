import { beforeEach, describe, expect, it } from 'vitest';
import type { DadosNovaCompra } from '@/domain/compras';
import { recalcularFechamento } from '@/domain/faturas';
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
        ativo: true,
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
          ativo: true,
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
            ativo: true,
          },
          {
            id: azul,
            nome: 'Cartão Azul Black',
            diaFechamento: 5,
            diaVencimento: 15,
            limiteCentavos: 1_000_000,
            cor: '#3B82F6',
            ativo: true,
          },
        ]);
      });

      it('categorias e terceiros seguem o mesmo contrato', async () => {
        const feira = await repos.categorias.criar({ nome: 'Feira', icone: 'carrot', ativo: true });
        await repos.categorias.atualizar(feira, { ativo: false });
        await repos.terceiros.atualizar(ana, { ativo: false });

        expect((await repos.categorias.listar()).find((c) => c.id === feira)).toEqual({
          id: feira,
          nome: 'Feira',
          icone: 'carrot',
          ativo: false,
        });
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

    describe('uso em compras', () => {
      it('diz se cartão, categoria e pessoa já têm compras, mesmo excluídas', async () => {
        const feira = await repos.categorias.criar({ nome: 'Feira', icone: 'carrot', ativo: true });
        const bruno = await repos.terceiros.criar({ nome: 'Bruno', cor: '#2563EB', ativo: true });
        expect(await repos.cartoes.possuiCompras(cartaoRoxo)).toBe(false);

        const id = await repos.compras.salvar(
          compra({
            categoriaId: feira,
            rateios: [
              { terceiroId: null, percentual: 50 },
              { terceiroId: ana, percentual: 50 },
            ],
          }),
        );
        await repos.compras.excluir(id);

        expect(await repos.cartoes.possuiCompras(cartaoRoxo)).toBe(true);
        expect(await repos.categorias.possuiCompras(feira)).toBe(true);
        expect(await repos.terceiros.possuiCompras(ana)).toBe(true);
        expect(await repos.terceiros.possuiCompras(bruno)).toBe(false);
      });
    });

    describe('recálculo do fechamento', () => {
      const roxo = {
        nome: 'Cartão Roxo',
        diaFechamento: 25,
        diaVencimento: 5,
        limiteCentavos: 500_000,
        cor: '#8B5CF6',
        ativo: true,
      };

      it('lista as compras do cartão com as parcelas', async () => {
        const id = await repos.compras.salvar(compra({ dataCompra: '2026-10-26', numParcelas: 2 }));

        expect(await repos.cartoes.comprasParaRecalculo(cartaoRoxo)).toEqual([
          {
            compraId: id,
            descricao: 'Tênis',
            dataCompra: '2026-10-26',
            parcelas: [
              { numero: 1, competencia: '2026-10' },
              { numero: 2, competencia: '2026-11' },
            ],
          },
        ]);
      });

      it('grava o cartão e move as parcelas juntos', async () => {
        await repos.compras.salvar(compra({ dataCompra: '2026-10-26' }));
        const mudancas = recalcularFechamento(
          await repos.cartoes.comprasParaRecalculo(cartaoRoxo),
          28,
          25,
          '2026-10-20',
        );

        await repos.cartoes.atualizarComParcelas(cartaoRoxo, roxo, mudancas);

        expect(await repos.compras.parcelasDaCompetencia('2026-10')).toEqual([]);
        expect((await repos.compras.parcelasDaCompetencia('2027-01'))[0]?.numero).toBe(3);
        expect((await repos.cartoes.listar())[0]?.diaFechamento).toBe(25);
      });

      it('não grava nada se uma parcela não existe', async () => {
        const id = await repos.compras.salvar(compra({ dataCompra: '2026-10-26' }));

        await expect(
          repos.cartoes.atualizarComParcelas(cartaoRoxo, roxo, [
            {
              compraId: id,
              descricao: 'Tênis',
              de: '2026-10',
              para: '2026-11',
              parcelas: [
                { numero: 1, competencia: '2026-11' },
                { numero: 99, competencia: '2027-01' },
              ],
            },
          ]),
        ).rejects.toThrow();

        expect((await repos.cartoes.listar())[0]?.diaFechamento).toBe(28);
        expect(await repos.compras.parcelasDaCompetencia('2026-10')).toHaveLength(1);
      });

      it('recusa cartão inexistente', async () => {
        await expect(repos.cartoes.atualizarComParcelas(9999, roxo, [])).rejects.toThrow(
          'não encontrado',
        );
      });
    });

    describe('pagamento de faturas', () => {
      const pagamento = {
        cartaoId: 0,
        competencia: '2026-10',
        pagoEm: '2026-11-04',
        valorPagoCentavos: 64_950,
      };

      it('marca, corrige e desmarca a fatura paga', async () => {
        await repos.faturas.marcarComoPaga({ ...pagamento, cartaoId: cartaoRoxo });
        await repos.faturas.marcarComoPaga({
          ...pagamento,
          cartaoId: cartaoRoxo,
          valorPagoCentavos: 70_000,
        });
        await repos.faturas.marcarComoPaga({
          ...pagamento,
          cartaoId: cartaoRoxo,
          competencia: '2026-11',
        });

        expect(await repos.faturas.pagamentos()).toEqual([
          { ...pagamento, cartaoId: cartaoRoxo, valorPagoCentavos: 70_000 },
          { ...pagamento, cartaoId: cartaoRoxo, competencia: '2026-11' },
        ]);

        await repos.faturas.desmarcar(cartaoRoxo, '2026-10');
        expect((await repos.faturas.pagamentos()).map((p) => p.competencia)).toEqual(['2026-11']);
      });

      it('recusa cartão inexistente', async () => {
        await expect(
          repos.faturas.marcarComoPaga({ ...pagamento, cartaoId: 9999 }),
        ).rejects.toThrow('não encontrado');
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

      it('lista as categorias usadas, da compra mais recente para a mais antiga', async () => {
        const feira = await repos.categorias.criar({ nome: 'Feira', icone: 'carrot', ativo: true });
        const lazer = await repos.categorias.criar({
          nome: 'Lazer',
          icone: 'party-popper',
          ativo: true,
        });
        await repos.compras.salvar(compra({ descricao: 'Feira livre', categoriaId: feira }));
        await repos.compras.salvar(compra({ descricao: 'Cinema', categoriaId: lazer }));
        const excluida = await repos.compras.salvar(
          compra({ descricao: 'Show', categoriaId: lazer }),
        );
        await repos.compras.excluir(excluida);
        await repos.compras.salvar(compra({ descricao: 'Sem categoria' }));

        expect(await repos.compras.ultimasCategorias()).toEqual([
          { descricao: 'Cinema', categoriaId: lazer },
          { descricao: 'Feira livre', categoriaId: feira },
        ]);
      });

      it('busca a compra com rateio, observação e parcelas', async () => {
        const id = await repos.compras.salvar(
          compra({
            observacao: 'presente',
            rateios: [
              { terceiroId: null, percentual: 50 },
              { terceiroId: ana, percentual: 50 },
            ],
          }),
        );

        expect(await repos.compras.buscar(id)).toEqual({
          id,
          cartaoId: cartaoRoxo,
          descricao: 'Tênis',
          categoriaId: null,
          valorTotal: 64_950,
          numParcelas: 3,
          dataCompra: '2026-10-19',
          recorrente: false,
          observacao: 'presente',
          rateios: [
            { terceiroId: null, percentual: 50 },
            { terceiroId: ana, percentual: 50 },
          ],
          parcelas: [
            { numero: 1, competencia: '2026-10', valorCentavos: 21_650 },
            { numero: 2, competencia: '2026-11', valorCentavos: 21_650 },
            { numero: 3, competencia: '2026-12', valorCentavos: 21_650 },
          ],
        });
      });

      it('substitui a compra gerando as parcelas de novo', async () => {
        const id = await repos.compras.salvar(compra());

        await repos.compras.substituir(
          id,
          compra({
            descricao: 'Tênis novo',
            numParcelas: 2,
            valorTotal: 10_001,
            rateios: [{ terceiroId: ana, percentual: 100 }],
          }),
        );

        const atual = await repos.compras.buscar(id);
        expect(atual).toMatchObject({
          descricao: 'Tênis novo',
          numParcelas: 2,
          valorTotal: 10_001,
        });
        expect(atual.rateios).toEqual([{ terceiroId: ana, percentual: 100 }]);
        expect(atual.parcelas).toEqual([
          { numero: 1, competencia: '2026-10', valorCentavos: 5_001 },
          { numero: 2, competencia: '2026-11', valorCentavos: 5_000 },
        ]);
        expect(await repos.compras.parcelasDaCompetencia('2026-12')).toEqual([]);
      });

      it('substitui mantendo as parcelas quando pedido', async () => {
        const id = await repos.compras.salvar(compra({ dataCompra: '2026-10-26' }));
        await repos.cartoes.atualizar(cartaoRoxo, { diaFechamento: 25 });

        await repos.compras.substituir(
          id,
          compra({ dataCompra: '2026-10-26', descricao: 'Renomeada' }),
          { manterParcelas: true },
        );

        const [outubro] = await repos.compras.parcelasDaCompetencia('2026-10');
        expect(outubro).toMatchObject({ descricao: 'Renomeada', numero: 1 });
      });

      it('recusa buscar ou substituir compra excluída ou inexistente', async () => {
        const id = await repos.compras.salvar(compra());
        await repos.compras.excluir(id);

        await expect(repos.compras.buscar(id)).rejects.toThrow('não encontrado');
        await expect(repos.compras.substituir(id, compra())).rejects.toThrow('não encontrad');
        await expect(repos.compras.buscar(9999)).rejects.toThrow('não encontrad');
      });

      it('recusa excluir compra inexistente', async () => {
        await expect(repos.compras.excluir(9999)).rejects.toThrow('não encontrado');
      });
    });
  });
}
