import type { Repositorios } from '../repositories';

export async function semearDadosFicticios(repos: Repositorios) {
  const roxo = await repos.cartoes.criar({
    nome: 'Cartão Roxo',
    diaFechamento: 28,
    diaVencimento: 5,
    limiteCentavos: 500_000,
    cor: '#8B5CF6',
    ativo: true,
  });
  const azul = await repos.cartoes.criar({
    nome: 'Cartão Azul',
    diaFechamento: 3,
    diaVencimento: 10,
    limiteCentavos: 800_000,
    cor: '#3B82F6',
    ativo: true,
  });
  const verdeAgua = await repos.cartoes.criar({
    nome: 'Cartão Verde-água',
    diaFechamento: 20,
    diaVencimento: 28,
    limiteCentavos: 300_000,
    cor: '#14B8A6',
    ativo: true,
  });

  const mercado = await repos.categorias.criar({
    nome: 'Mercado',
    icone: 'shopping-cart',
    ativo: true,
  });
  const restaurante = await repos.categorias.criar({
    nome: 'Restaurante',
    icone: 'utensils',
    ativo: true,
  });
  const transporte = await repos.categorias.criar({
    nome: 'Transporte',
    icone: 'car',
    ativo: true,
  });
  const compras = await repos.categorias.criar({
    nome: 'Compras',
    icone: 'shopping-bag',
    ativo: true,
  });
  const assinaturas = await repos.categorias.criar({
    nome: 'Assinaturas',
    icone: 'repeat',
    ativo: true,
  });

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

  const tenis = await compra(roxo, 'Tênis de corrida', compras, 129_900, 6, '2026-10-02', [
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
  const assinatura = async (
    dados: Omit<Parameters<typeof repos.assinaturas.criar>[0], 'ativa' | 'inicio'>,
  ) => {
    const id = await repos.assinaturas.criar({ ...dados, ativa: true, inicio: '2026-10' });
    await repos.compras.salvar({
      cartaoId: dados.cartaoId,
      descricao: dados.nome,
      categoriaId: dados.categoriaId,
      valorTotal: dados.valorCentavos,
      numParcelas: 1,
      dataCompra: `2026-10-${String(dados.dia).padStart(2, '0')}`,
      recorrente: true,
      rateios: dados.rateios,
      assinatura: { id, mes: '2026-10' },
    });
  };
  await assinatura({
    nome: 'Streaming',
    cartaoId: verdeAgua,
    categoriaId: assinaturas,
    valorCentavos: 5590,
    dia: 5,
    rateios: [],
  });
  await assinatura({
    nome: 'Nuvem 2 TB',
    cartaoId: azul,
    categoriaId: assinaturas,
    valorCentavos: 2940,
    dia: 25,
    rateios: [
      { terceiroId: null, percentual: 50 },
      { terceiroId: ana, percentual: 50 },
    ],
  });
  await compra(verdeAgua, 'Farmácia', mercado, 8_420, 1, '2026-10-08', [
    { terceiroId: null, percentual: 50 },
    { terceiroId: bruno, percentual: 50 },
  ]);

  const setembro = await repos.compras.parcelasDaCompetencia('2026-09');
  for (const cartaoId of [roxo, azul, verdeAgua]) {
    const total = setembro
      .filter((p) => p.cartaoId === cartaoId)
      .reduce((soma, p) => soma + p.valorCentavos, 0);
    if (total > 0) {
      await repos.faturas.marcarComoPaga({
        cartaoId,
        competencia: '2026-09',
        pagoEm: '2026-10-04',
        valorPagoCentavos: total,
      });
    }
  }

  await repos.receitas.criar({
    descricao: 'Salário',
    valorCentavos: 650_000,
    competencia: '2026-01',
    competenciaFim: null,
    recorrente: true,
  });
  await repos.receitas.criar({
    descricao: 'Freela',
    valorCentavos: 70_000,
    competencia: '2026-10',
    competenciaFim: null,
    recorrente: false,
  });

  await repos.receber.registrarDeposito({
    terceiroId: ana,
    valorCentavos: 10_825,
    data: '2026-10-15',
    competencia: '2026-10',
    abatimentos: [{ compraId: tenis, numero: 1, valor: 10_825 }],
  });

  const pessoal = await repos.emprestimos.tomados.criar({
    descricao: 'Empréstimo pessoal',
    valorCentavos: 490_000,
    numParcelas: 12,
    valorParcelaCentavos: 48_000,
    dia: 10,
    inicio: '2026-05',
    data: '2026-04-10',
  });
  for (let numero = 1; numero <= 6; numero++) {
    await repos.emprestimos.marcarPaga({
      emprestimoId: pessoal,
      numero,
      pagoEm: `2026-${String(4 + numero).padStart(2, '0')}-10`,
    });
  }
  await repos.emprestimos.concedidos.criar({
    terceiroId: bruno,
    descricao: 'Empréstimo',
    valorCentavos: 80_000,
    data: '2026-08-15',
    prazo: '2026-10-15',
  });

  await repos.economias.metas.definir({ valorCentavos: 80_000, inicio: '2025-11' });
  const reserva = await repos.economias.objetivos.criar({
    nome: 'Reserva de emergência',
    alvoCentavos: 2_000_000,
    prazo: null,
  });
  const apartamento = await repos.economias.objetivos.criar({
    nome: 'Entrada do apartamento',
    alvoCentavos: 6_000_000,
    prazo: '2030-12',
  });
  const viagem = await repos.economias.objetivos.criar({
    nome: 'Viagem para o Chile',
    alvoCentavos: 800_000,
    prazo: '2027-07',
  });
  const guardar = (data: string, valorCentavos: number, objetivoId: number) =>
    repos.economias.movimentos.criar({ data, valorCentavos, objetivoId });
  await guardar('2025-06-01', 445_000, reserva);
  await guardar('2025-06-01', 1_800_000, apartamento);
  await guardar('2025-06-01', 315_000, viagem);
  const meses: [string, number][] = [
    ['2025-11', 60_000],
    ['2025-12', 80_000],
    ['2026-01', 40_000],
    ['2026-02', 80_000],
    ['2026-03', 85_000],
    ['2026-04', 80_000],
    ['2026-05', 20_000],
    ['2026-06', 70_000],
    ['2026-07', 80_000],
    ['2026-08', 90_000],
    ['2026-09', 80_000],
    ['2026-10', 50_000],
  ];
  for (const [mes, valor] of meses) await guardar(`${mes}-05`, valor, reserva);
  await guardar('2026-05-20', -20_000, reserva);
}
