import type { Repositorios } from '../repositories';

export async function semearDadosFicticios(repos: Repositorios) {
  const roxo = await repos.cartoes.criar({
    nome: 'Cartão Roxo',
    diaFechamento: 28,
    diaVencimento: 5,
    limiteCentavos: 500_000,
    cor: '#8B5CF6',
  });
  const azul = await repos.cartoes.criar({
    nome: 'Cartão Azul',
    diaFechamento: 3,
    diaVencimento: 10,
    limiteCentavos: 800_000,
    cor: '#3B82F6',
  });
  const verdeAgua = await repos.cartoes.criar({
    nome: 'Cartão Verde-água',
    diaFechamento: 20,
    diaVencimento: 28,
    limiteCentavos: 300_000,
    cor: '#14B8A6',
  });

  const mercado = await repos.categorias.criar({ nome: 'Mercado', icone: 'shopping-cart' });
  const restaurante = await repos.categorias.criar({ nome: 'Restaurante', icone: 'utensils' });
  const transporte = await repos.categorias.criar({ nome: 'Transporte', icone: 'car' });
  const compras = await repos.categorias.criar({ nome: 'Compras', icone: 'shopping-bag' });
  const assinaturas = await repos.categorias.criar({ nome: 'Assinaturas', icone: 'repeat' });

  const ana = await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true });
  const bruno = await repos.terceiros.criar({ nome: 'Bruno', cor: '#2563EB', ativo: true });
  const carla = await repos.terceiros.criar({ nome: 'Carla', cor: '#2563EB', ativo: true });
  await repos.terceiros.criar({ nome: 'Daniel', cor: '#2563EB', ativo: true });

  const compra = (
    cartaoId: number,
    descricao: string,
    categoriaId: number,
    valorTotal: number,
    numParcelas: number,
    dataCompra: string,
    rateios: { terceiroId: number | null; percentual: number }[] = [],
  ) =>
    repos.compras.salvar({
      cartaoId,
      descricao,
      categoriaId,
      valorTotal,
      numParcelas,
      dataCompra,
      recorrente: false,
      rateios,
    });

  await compra(roxo, 'Tênis de corrida', compras, 129_900, 6, '2026-10-02', [
    { terceiroId: null, percentual: 50 },
    { terceiroId: ana, percentual: 50 },
  ]);
  await compra(roxo, 'Supermercado', mercado, 48_730, 1, '2026-10-12');
  await compra(roxo, 'Jantar de aniversário', restaurante, 32_000, 1, '2026-10-18', [
    { terceiroId: ana, percentual: 100 },
  ]);
  await compra(azul, 'Passagem de ônibus', transporte, 15_000, 1, '2026-09-30', [
    { terceiroId: carla, percentual: 100 },
  ]);
  await compra(azul, 'Notebook', compras, 480_000, 10, '2026-06-15');
  await compra(verdeAgua, 'Streaming', assinaturas, 5590, 1, '2026-10-05');
  await compra(verdeAgua, 'Farmácia', mercado, 8_420, 1, '2026-10-08', [
    { terceiroId: null, percentual: 50 },
    { terceiroId: bruno, percentual: 50 },
  ]);
}
