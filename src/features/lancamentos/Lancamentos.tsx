import { useEffect, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import type { Cartao, Categoria, CompraGravada, ParcelaDoMes, Terceiro } from '@/data';
import { linhasPorDono } from '@/domain/faturas';
import type { Rateio } from '@/domain/terceiros';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import { TabelaDeLancamentos, type AcoesDaTabela } from './TabelaDeLancamentos';
import { Toolbar, type Colunas, type Filtros } from './Toolbar';

const CHAVE_COLUNAS = 'fecho:colunas-lancamentos';
const TODAS_AS_COLUNAS: Colunas = { categoria: true, cartao: true, dono: true };

function lerColunas(): Colunas {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_COLUNAS) ?? '{}') as Partial<Colunas>;
    return { ...TODAS_AS_COLUNAS, ...salvas };
  } catch {
    return TODAS_AS_COLUNAS;
  }
}

function gravarColunas(colunas: Colunas) {
  try {
    localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(colunas));
  } catch {
    // sem armazenamento, a escolha vale só nesta sessão
  }
}

export interface LinhaDeLancamento {
  id: string;
  compraId: number;
  parcelaId: number;
  dono: number | null;
  nomeDono: string;
  valorCentavos: number;
  dataCompra: string;
  descricao: string;
  numero: number;
  numParcelas: number;
  recorrente: boolean;
  categoriaId: number | null;
  categoria: string;
  cartao: Cartao | undefined;
}

interface Dados {
  cartoes: Cartao[];
  categorias: Categoria[];
  terceiros: Terceiro[];
  parcelas: ParcelaDoMes[];
}

function montarLinhas(dados: Dados): LinhaDeLancamento[] {
  return linhasPorDono(dados.parcelas).flatMap(({ parcelaId, dono, valorCentavos }) => {
    const p = dados.parcelas.find((parcela) => parcela.parcelaId === parcelaId);
    if (!p) return [];
    return [
      {
        id: `${parcelaId}-${dono ?? 'meu'}`,
        compraId: p.compraId,
        parcelaId,
        dono,
        nomeDono: dono === null ? 'Meu' : (dados.terceiros.find((t) => t.id === dono)?.nome ?? ''),
        valorCentavos,
        dataCompra: p.dataCompra,
        descricao: p.descricao,
        numero: p.numero,
        numParcelas: p.numParcelas,
        recorrente: p.recorrente,
        categoriaId: p.categoriaId,
        categoria: dados.categorias.find((c) => c.id === p.categoriaId)?.nome ?? '',
        cartao: dados.cartoes.find((c) => c.id === p.cartaoId),
      },
    ];
  });
}

const lista = (valor: string | null) => (valor ?? '').split(',').filter(Boolean).map(Number);

function filtrar(linhas: LinhaDeLancamento[], filtros: Filtros) {
  const termo = filtros.q.trim().toLocaleLowerCase('pt-BR');
  return linhas.filter(
    (l) =>
      (filtros.ver === 'todos' || (filtros.ver === 'meu' ? l.dono === null : l.dono !== null)) &&
      (!termo || l.descricao.toLocaleLowerCase('pt-BR').includes(termo)) &&
      (filtros.cartoes.length === 0 || filtros.cartoes.includes(l.cartao?.id ?? -1)) &&
      (filtros.categorias.length === 0 || filtros.categorias.includes(l.categoriaId ?? -1)),
  );
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export function Lancamentos() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const definirLegenda = useApp((s) => s.definirLegenda);
  const abrirNovaCompra = useApp((s) => s.abrirNovaCompra);
  const editarCompra = useApp((s) => s.editarCompra);
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useSearchParams();
  const campoDeBusca = useRef<HTMLInputElement>(null);
  const [colunas, setColunas] = useState(lerColunas);
  const [termo, setTermo] = useState(() => busca.get('q') ?? '');

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.cartoes.listar(),
      repos.categorias.listar(),
      repos.terceiros.listar(),
      repos.compras.parcelasDaCompetencia(competencia),
    ]).then(([cartoes, categorias, terceiros, parcelas]) => {
      if (montado) setDados({ cartoes, categorias, terceiros, parcelas });
    });
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao]);

  useEffect(() => {
    definirLegenda(`${nomeDoMes(competencia)} · duplo clique edita, botão direito abre mais ações`);
    return () => {
      definirLegenda(null);
    };
  }, [definirLegenda, competencia]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        campoDeBusca.current?.focus();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  const ver = busca.get('ver');
  const filtros: Filtros = {
    q: termo,
    ver: ver === 'meu' || ver === 'terceiros' ? ver : 'todos',
    cartoes: lista(busca.get('cartoes')),
    categorias: lista(busca.get('categorias')),
  };

  const mudarFiltros = (mudanca: Partial<Filtros>) => {
    if (mudanca.q !== undefined) setTermo(mudanca.q);
    setBusca(
      (atual) => {
        const nova = new URLSearchParams(atual);
        for (const [chave, valor] of Object.entries(mudanca)) {
          const texto = Array.isArray(valor) ? valor.join(',') : valor;
          if (texto && texto !== 'todos') nova.set(chave, texto);
          else nova.delete(chave);
        }
        return nova;
      },
      { replace: true },
    );
  };

  if (!dados) return null;

  const todas = montarLinhas(dados);
  const linhas = filtrar(todas, filtros);
  const filtrado =
    filtros.q !== '' ||
    filtros.cartoes.length > 0 ||
    filtros.categorias.length > 0 ||
    filtros.ver !== 'todos';

  const alterarCompras = async (
    ids: number[],
    alterar: (compra: CompraGravada) => CompraGravada,
    mensagem: string,
  ) => {
    await executar(async () => {
      const anteriores = await Promise.all(ids.map((id) => repos.compras.buscar(id)));
      for (const compra of anteriores) {
        await repos.compras.substituir(compra.id, alterar(compra), { parcelas: compra.parcelas });
      }
      dadosMudaram();
      toast.success(mensagem, {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void executar(async () => {
              for (const compra of anteriores) {
                await repos.compras.substituir(compra.id, compra, { parcelas: compra.parcelas });
              }
              dadosMudaram();
            }),
        },
      });
    });
  };

  const acoes: AcoesDaTabela = {
    renomear: async (compraId, descricao) => {
      await alterarCompras([compraId], (c) => ({ ...c, descricao }), 'Descrição atualizada');
    },
    mudarCategoria: async (ids, categoriaId) => {
      await alterarCompras(
        ids,
        (c) => ({ ...c, categoriaId }),
        `Categoria alterada em ${ids.length} ${plural(ids.length, 'compra', 'compras')}`,
      );
    },
    mudarDono: async (ids, dono) => {
      const rateios: Rateio[] = dono === null ? [] : [{ terceiroId: dono, percentual: 100 }];
      const nome = dono === null ? null : dados.terceiros.find((t) => t.id === dono)?.nome;
      const quantas = `${ids.length} ${plural(ids.length, 'compra marcada', 'compras marcadas')}`;
      await alterarCompras(
        ids,
        (c) => ({ ...c, rateios }),
        nome
          ? `${quantas} como de ${nome}`
          : `${quantas} como ${plural(ids.length, 'sua', 'suas')}`,
      );
    },
    excluir: async (ids) => {
      await executar(async () => {
        for (const id of ids) await repos.compras.excluir(id);
        dadosMudaram();
        toast.success(ids.length === 1 ? 'Compra excluída' : `${ids.length} compras excluídas`, {
          action: {
            label: 'Desfazer',
            onClick: () =>
              void executar(async () => {
                for (const id of ids) await repos.compras.restaurar(id);
                dadosMudaram();
              }),
          },
        });
      });
    },
    duplicar: async (compraId) => {
      await executar(async () => {
        abrirNovaCompra(await repos.compras.buscar(compraId));
      });
    },
    editar: (compraId) => {
      editarCompra(compraId);
    },
  };

  const soma = (filtro: (l: LinhaDeLancamento) => boolean) =>
    formatarMoeda(linhas.filter(filtro).reduce((total, l) => total + l.valorCentavos, 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Toolbar
        filtros={filtros}
        cartoes={dados.cartoes}
        categorias={dados.categorias}
        colunas={colunas}
        campoDeBusca={campoDeBusca}
        onMudar={mudarFiltros}
        onColunas={(novas) => {
          setColunas(novas);
          gravarColunas(novas);
        }}
      />

      {todas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border bg-surface text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-soft">
            <Plus size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
          </span>
          <p className="text-sm text-ink-muted">
            Nada lançado em {nomeDoMes(competencia).split(' ')[0]} ainda.
          </p>
          <Button
            onClick={() => {
              abrirNovaCompra();
            }}
          >
            Registrar compra
          </Button>
        </div>
      ) : linhas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border bg-surface text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-soft">
            <Search size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
          </span>
          <p className="text-sm text-ink-muted">Nada encontrado com esse filtro.</p>
          <Button
            variant="outline"
            onClick={() => {
              setTermo('');
              setBusca(new URLSearchParams(), { replace: true });
            }}
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-surface">
          <TabelaDeLancamentos
            linhas={linhas}
            competencia={competencia}
            colunas={colunas}
            categorias={dados.categorias.filter((c) => c.ativo)}
            terceiros={dados.terceiros.filter((t) => t.ativo)}
            acoes={acoes}
          />
          <div className="flex h-10 flex-none items-center gap-6 border-t px-4 text-[13px] text-ink-muted tabular-nums">
            <span className="flex-1">
              {linhas.length} {plural(linhas.length, 'lançamento', 'lançamentos')}
              {filtrado && ` de ${todas.length}`}
            </span>
            <span>
              Meu <b className="font-semibold text-ink">{soma((l) => l.dono === null)}</b>
            </span>
            <span>
              Terceiros <b className="font-semibold text-ink">{soma((l) => l.dono !== null)}</b>
            </span>
            <span>
              Total <b className="font-semibold text-ink">{soma(() => true)}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
