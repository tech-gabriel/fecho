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

      it('guarda banco, final e bandeira só quando informados', async () => {
        const verde = await repos.cartoes.criar({
          nome: 'Cartão Verde',
          banco: 'Banco Aurora',
          final: '4821',
          bandeira: 'visa',
          diaFechamento: 5,
          diaVencimento: 15,
          limiteCentavos: 0,
          cor: '#14B8A6',
          ativo: true,
        });
        await repos.cartoes.atualizarComParcelas(
          verde,
          {
            nome: 'Cartão Verde',
            banco: 'Banco Aurora',
            final: '0007',
            bandeira: 'elo',
            diaFechamento: 5,
            diaVencimento: 15,
            limiteCentavos: 0,
            cor: '#14B8A6',
            ativo: true,
          },
          [],
        );

        const [roxo, lido] = await repos.cartoes.listar();
        expect(lido).toMatchObject({ banco: 'Banco Aurora', final: '0007', bandeira: 'elo' });
        expect(roxo).not.toHaveProperty('banco');
        expect(roxo).not.toHaveProperty('final');
        expect(roxo).not.toHaveProperty('bandeira');
      });

      it('cadastra conta fixa e marca, corrige e desmarca o pagamento do mês', async () => {
        const aluguel = await repos.contasFixas.criar({
          descricao: 'Aluguel',
          categoriaId: null,
          valorCentavos: 180_000,
          dia: 10,
          inicio: '2026-10',
          ativa: true,
          rateios: [
            { terceiroId: null, percentual: 50 },
            { terceiroId: ana, percentual: 50 },
          ],
        });
        expect(await repos.contasFixas.listar()).toEqual([
          expect.objectContaining({
            id: aluguel,
            descricao: 'Aluguel',
            rateios: [
              { terceiroId: null, percentual: 50 },
              { terceiroId: ana, percentual: 50 },
            ],
          }),
        ]);
        expect(await repos.contasFixas.possuiCompras(aluguel)).toBe(false);

        const pagamento = {
          contaId: aluguel,
          competencia: '2026-10',
          valorCentavos: 180_000,
          pagoEm: '2026-10-09',
        };
        await repos.contasFixas.marcarPaga(pagamento);
        await repos.contasFixas.marcarPaga({ ...pagamento, valorCentavos: 182_500 });
        expect(await repos.contasFixas.pagamentos()).toEqual([
          { ...pagamento, valorCentavos: 182_500 },
        ]);
        expect(await repos.contasFixas.possuiCompras(aluguel)).toBe(true);

        await repos.contasFixas.desmarcar(aluguel, '2026-10');
        expect(await repos.contasFixas.pagamentos()).toEqual([]);
        await expect(
          repos.contasFixas.marcarPaga({ ...pagamento, contaId: 999 }),
        ).rejects.toThrow();
      });

      it('guarda e tira o limite mensal da categoria', async () => {
        const feira = await repos.categorias.criar({
          nome: 'Feira',
          icone: 'carrot',
          limiteCentavos: 50_000,
          ativo: true,
        });
        const lida = async () => (await repos.categorias.listar()).find((c) => c.id === feira);
        expect(await lida()).toMatchObject({ limiteCentavos: 50_000 });

        await repos.categorias.atualizar(feira, { limiteCentavos: null });

        expect((await lida())?.limiteCentavos ?? null).toBeNull();
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

    describe('receitas e preferências', () => {
      it('cria, encerra e exclui receitas', async () => {
        const salario = await repos.receitas.criar({
          descricao: 'Salário',
          valorCentavos: 650_000,
          competencia: '2026-01',
          competenciaFim: null,
          recorrente: true,
        });
        const freela = await repos.receitas.criar({
          descricao: 'Freela',
          valorCentavos: 70_000,
          competencia: '2026-10',
          competenciaFim: null,
          recorrente: false,
        });

        await repos.receitas.atualizar(salario, { competenciaFim: '2026-09' });
        await repos.receitas.excluir(freela);

        expect(await repos.receitas.listar()).toEqual([
          {
            id: salario,
            descricao: 'Salário',
            valorCentavos: 650_000,
            competencia: '2026-01',
            competenciaFim: '2026-09',
            recorrente: true,
          },
        ]);
      });

      it('lê o limite padrão e grava o escolhido', async () => {
        expect(await repos.preferencias.ler()).toMatchObject({
          limiteRendaComprometida: 30,
          backupAutomatico: true,
          ultimoBackup: null,
          chavePix: '',
        });
        await repos.preferencias.gravar({ limiteRendaComprometida: 40 });
        await repos.preferencias.gravar({
          backupAutomatico: false,
          ultimoBackup: '2026-10-20T11:12:00.000Z',
        });
        expect(await repos.preferencias.ler()).toMatchObject({
          limiteRendaComprometida: 40,
          backupAutomatico: false,
          ultimoBackup: '2026-10-20T11:12:00.000Z',
        });
      });
    });

    describe('a receber', () => {
      it('registra depósito com abatimentos, cobrança, e exclui/restaura', async () => {
        const id = await repos.compras.salvar(
          compra({ rateios: [{ terceiroId: ana, percentual: 100 }] }),
        );
        const deposito = await repos.receber.registrarDeposito({
          terceiroId: ana,
          valorCentavos: 30_000,
          data: '2026-10-20',
          competencia: '2026-10',
          abatimentos: [{ compraId: id, numero: 1, valor: 21_650 }],
        });
        const cobranca = await repos.receber.registrarCobranca({
          terceiroId: ana,
          valorCentavos: 43_300,
          data: '2026-10-21',
          competencia: '2026-10',
        });

        expect(await repos.receber.movimentos()).toEqual([
          {
            id: deposito,
            terceiroId: ana,
            tipo: 'deposito',
            valorCentavos: 30_000,
            data: '2026-10-20',
            competencia: '2026-10',
            abatimentos: [{ compraId: id, numero: 1, valor: 21_650 }],
          },
          {
            id: cobranca,
            terceiroId: ana,
            tipo: 'cobranca',
            valorCentavos: 43_300,
            data: '2026-10-21',
            competencia: '2026-10',
            abatimentos: [],
          },
        ]);

        await repos.receber.excluir(deposito);
        expect((await repos.receber.movimentos()).map((m) => m.tipo)).toEqual(['cobranca']);
        await repos.receber.restaurar(deposito);
        expect(await repos.receber.movimentos()).toHaveLength(2);
        await expect(repos.receber.excluir(9999)).rejects.toThrow('não encontrado');
        await expect(
          repos.receber.registrarDeposito({
            terceiroId: 9999,
            valorCentavos: 1,
            data: '2026-10-20',
            competencia: '2026-10',
            abatimentos: [],
          }),
        ).rejects.toThrow('não encontrado');
      });

      it('lista as parcelas com terceiros até o mês', async () => {
        await repos.compras.salvar(compra({ descricao: 'Minha' }));
        await repos.compras.salvar(
          compra({ descricao: 'Da Ana', rateios: [{ terceiroId: ana, percentual: 100 }] }),
        );

        const ate = await repos.compras.parcelasDeTerceiros('2026-11');
        expect(ate.map((p) => [p.descricao, p.competencia])).toEqual([
          ['Da Ana', '2026-10'],
          ['Da Ana', '2026-11'],
        ]);
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
          { parcelas: (await repos.compras.buscar(id)).parcelas },
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

      it('importa várias compras de uma vez, ou nenhuma', async () => {
        const ids = await repos.compras.importar([
          compra({ descricao: 'Mercado', numParcelas: 1 }),
          compra({ descricao: 'TV', numParcelas: 2 }),
        ]);
        expect(ids).toHaveLength(2);
        expect(
          (await repos.compras.parcelasDaCompetencia('2026-10')).map((p) => p.descricao),
        ).toEqual(['Mercado', 'TV']);

        await expect(
          repos.compras.importar([compra({ descricao: 'Ok' }), compra({ valorTotal: 0 })]),
        ).rejects.toThrow('Digite um valor maior que zero');
        expect(await repos.compras.parcelasDaCompetencia('2026-10')).toHaveLength(2);
      });

      it('lista o resumo das compras não excluídas', async () => {
        const id = await repos.compras.salvar(compra());
        const excluida = await repos.compras.salvar(compra({ descricao: 'Outra' }));
        await repos.compras.excluir(excluida);

        expect(await repos.compras.listar()).toEqual([
          {
            id,
            dataCompra: '2026-10-19',
            cartaoId: cartaoRoxo,
            descricao: 'Tênis',
            valorTotal: 64_950,
          },
        ]);
      });

      it('recusa excluir compra inexistente', async () => {
        await expect(repos.compras.excluir(9999)).rejects.toThrow('não encontrado');
      });
    });

    describe('assinaturas', () => {
      const nuvem = () => ({
        nome: 'Nuvem 2 TB',
        cartaoId: cartaoRoxo,
        categoriaId: null,
        valorCentavos: 2_940,
        dia: 25,
        rateios: [
          { terceiroId: null, percentual: 50 },
          { terceiroId: ana, percentual: 50 },
        ],
        ativa: true,
        inicio: '2026-10',
      });

      it('cria, lista com o rateio, pausa e exclui', async () => {
        const id = await repos.assinaturas.criar(nuvem());
        expect(await repos.assinaturas.listar()).toEqual([{ id, ...nuvem() }]);

        await repos.assinaturas.atualizar(id, { ativa: false, valorCentavos: 3_000 });
        expect(await repos.assinaturas.listar()).toEqual([
          { id, ...nuvem(), ativa: false, valorCentavos: 3_000 },
        ]);

        await repos.assinaturas.excluir(id);
        expect(await repos.assinaturas.listar()).toEqual([]);
        await repos.assinaturas.restaurar(id);
        expect(await repos.assinaturas.listar()).toHaveLength(1);
      });

      it('marca o mês gerado, mesmo se a cobrança for excluída, e não gera duas vezes', async () => {
        const id = await repos.assinaturas.criar(nuvem());
        const cobranca = compra({
          descricao: 'Nuvem 2 TB',
          valorTotal: 2_940,
          numParcelas: 1,
          dataCompra: '2026-10-25',
          recorrente: true,
          assinatura: { id, mes: '2026-10' },
        });

        const compraId = await repos.compras.salvar(cobranca);
        await repos.compras.excluir(compraId);

        expect(await repos.assinaturas.geradas()).toEqual([`${String(id)}:2026-10`]);
        expect(await repos.assinaturas.possuiCompras(id)).toBe(true);
        await expect(repos.compras.salvar(cobranca)).rejects.toThrow();
      });

      it('editar a cobrança mantém a ligação com a assinatura', async () => {
        const id = await repos.assinaturas.criar(nuvem());
        const compraId = await repos.compras.salvar(
          compra({ numParcelas: 1, assinatura: { id, mes: '2026-10' } }),
        );

        await repos.compras.substituir(compraId, compra({ numParcelas: 1, valorTotal: 3_000 }));

        expect(await repos.assinaturas.geradas()).toEqual([`${String(id)}:2026-10`]);
      });
    });

    describe('empréstimos', () => {
      const pessoal = {
        descricao: 'Empréstimo pessoal',
        valorCentavos: 490_000,
        numParcelas: 12,
        valorParcelaCentavos: 48_000,
        dia: 10,
        inicio: '2026-05',
        data: '2026-04-10',
      };
      const bruno = () => ({
        terceiroId: ana,
        descricao: 'Empréstimo',
        valorCentavos: 80_000,
        data: '2026-08-15',
        prazo: '2026-10-15',
      });

      it('separa os tomados dos concedidos, edita e exclui', async () => {
        const tomado = await repos.emprestimos.tomados.criar(pessoal);
        const concedido = await repos.emprestimos.concedidos.criar(bruno());

        expect(await repos.emprestimos.tomados.listar()).toEqual([{ id: tomado, ...pessoal }]);
        expect(await repos.emprestimos.concedidos.listar()).toEqual([
          { id: concedido, ...bruno() },
        ]);

        await repos.emprestimos.concedidos.atualizar(concedido, { prazo: '2026-11-15' });
        expect((await repos.emprestimos.concedidos.listar())[0]?.prazo).toBe('2026-11-15');

        await repos.emprestimos.tomados.excluir(tomado);
        expect(await repos.emprestimos.tomados.listar()).toEqual([]);
        await repos.emprestimos.tomados.restaurar(tomado);
        expect(await repos.emprestimos.tomados.listar()).toHaveLength(1);
      });

      it('marca e desmarca parcelas pagas, só de empréstimo existente', async () => {
        const id = await repos.emprestimos.tomados.criar(pessoal);

        await repos.emprestimos.marcarPaga({ emprestimoId: id, numero: 2, pagoEm: '2026-06-10' });
        await repos.emprestimos.marcarPaga({ emprestimoId: id, numero: 1, pagoEm: '2026-05-10' });
        await repos.emprestimos.marcarPaga({ emprestimoId: id, numero: 1, pagoEm: '2026-05-11' });
        expect(await repos.emprestimos.pagamentos()).toEqual([
          { emprestimoId: id, numero: 1, pagoEm: '2026-05-11' },
          { emprestimoId: id, numero: 2, pagoEm: '2026-06-10' },
        ]);

        await repos.emprestimos.desmarcar(id, 1);
        expect(await repos.emprestimos.pagamentos()).toHaveLength(1);
        await expect(
          repos.emprestimos.marcarPaga({ emprestimoId: 999, numero: 1, pagoEm: '2026-05-10' }),
        ).rejects.toThrow();
      });

      it('o depósito pode abater um empréstimo concedido', async () => {
        const emprestimoId = await repos.emprestimos.concedidos.criar(bruno());

        await repos.receber.registrarDeposito({
          terceiroId: ana,
          valorCentavos: 30_000,
          data: '2026-10-20',
          competencia: '2026-10',
          abatimentos: [{ emprestimoId, valor: 30_000 }],
        });

        expect((await repos.receber.movimentos())[0]?.abatimentos).toEqual([
          { emprestimoId, valor: 30_000 },
        ]);
      });
    });

    describe('economias', () => {
      it('define a meta a partir de um mês, trocando a do mesmo mês', async () => {
        await repos.economias.metas.definir({ valorCentavos: 80_000, inicio: '2026-01' });
        await repos.economias.metas.definir({ valorCentavos: 90_000, inicio: '2026-12' });
        await repos.economias.metas.definir({ valorCentavos: 100_000, inicio: '2026-12' });

        expect(await repos.economias.metas.listar()).toEqual([
          { valorCentavos: 80_000, inicio: '2026-01' },
          { valorCentavos: 100_000, inicio: '2026-12' },
        ]);
      });

      it('guarda objetivos e registros, inclusive retiradas', async () => {
        const viagem = await repos.economias.objetivos.criar({
          nome: 'Viagem',
          alvoCentavos: 800_000,
          prazo: '2027-07',
        });
        const reserva = await repos.economias.objetivos.criar({
          nome: 'Reserva',
          alvoCentavos: 2_000_000,
          prazo: null,
        });
        const guardei = await repos.economias.movimentos.criar({
          data: '2026-10-05',
          valorCentavos: 30_000,
          objetivoId: viagem,
        });
        await repos.economias.movimentos.criar({
          data: '2026-10-06',
          valorCentavos: -5_000,
          objetivoId: null,
        });

        expect(await repos.economias.objetivos.listar()).toEqual([
          { id: viagem, nome: 'Viagem', alvoCentavos: 800_000, prazo: '2027-07' },
          { id: reserva, nome: 'Reserva', alvoCentavos: 2_000_000, prazo: null },
        ]);
        expect((await repos.economias.movimentos.listar()).map((m) => m.valorCentavos)).toEqual([
          30_000, -5_000,
        ]);

        await repos.economias.movimentos.excluir(guardei);
        expect(await repos.economias.movimentos.listar()).toHaveLength(1);
        await repos.economias.movimentos.restaurar(guardei);
        expect(await repos.economias.movimentos.listar()).toHaveLength(2);
        await expect(
          repos.economias.movimentos.criar({
            data: '2026-10-06',
            valorCentavos: 1,
            objetivoId: 999,
          }),
        ).rejects.toThrow();
      });
    });

    describe('fechamento do mês', () => {
      it('fecha, reabre e guarda as conferências', async () => {
        await repos.fechamento.fechar('2026-10', '2026-11-05');
        await repos.fechamento.fechar('2026-09', '2026-10-05');
        expect(await repos.fechamento.fechados()).toEqual(['2026-09', '2026-10']);
        await repos.fechamento.reabrir('2026-10');
        expect(await repos.fechamento.fechados()).toEqual(['2026-09']);

        await repos.fechamento.conferir({
          cartaoId: cartaoRoxo,
          competencia: '2026-10',
          extrato: 'fatura.csv',
          conferidaEm: '2026-11-03',
        });
        await repos.fechamento.conferir({
          cartaoId: cartaoRoxo,
          competencia: '2026-10',
          extrato: null,
          conferidaEm: '2026-11-04',
        });
        expect(await repos.fechamento.conferencias()).toEqual([
          {
            cartaoId: cartaoRoxo,
            competencia: '2026-10',
            extrato: null,
            conferidaEm: '2026-11-04',
          },
        ]);
        await repos.fechamento.desconferir(cartaoRoxo, '2026-10');
        expect(await repos.fechamento.conferencias()).toEqual([]);
      });

      it('não deixa mexer em compra de mês fechado', async () => {
        const id = await repos.compras.salvar(compra({ numParcelas: 1, dataCompra: '2026-10-02' }));
        await repos.fechamento.fechar('2026-10', '2026-11-05');

        await expect(
          repos.compras.salvar(compra({ numParcelas: 1, dataCompra: '2026-10-03' })),
        ).rejects.toMatchObject({ name: 'Error', competencia: '2026-10' });
        await expect(repos.compras.excluir(id)).rejects.toMatchObject({ competencia: '2026-10' });
        await expect(
          repos.compras.substituir(id, compra({ numParcelas: 1, dataCompra: '2026-11-02' })),
        ).rejects.toMatchObject({ competencia: '2026-10' });
        await expect(
          repos.faturas.marcarComoPaga({
            cartaoId: cartaoRoxo,
            competencia: '2026-10',
            pagoEm: '2026-11-05',
            valorPagoCentavos: 1,
          }),
        ).rejects.toMatchObject({ competencia: '2026-10' });
        await expect(
          repos.compras.salvar(compra({ numParcelas: 3, dataCompra: '2026-08-02' })),
        ).rejects.toMatchObject({ competencia: '2026-10' });

        expect(
          await repos.compras.salvar(compra({ numParcelas: 1, dataCompra: '2026-11-02' })),
        ).toBeGreaterThan(0);
        await repos.fechamento.reabrir('2026-10');
        await repos.compras.excluir(id);
      });
    });
  });
}
