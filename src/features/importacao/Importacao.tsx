import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { LogoSimbolo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import type { Cartao, Categoria, Terceiro } from '@/data';
import { rateioDaCompra, sugerirCategoria, type DadosNovaCompra } from '@/domain/compras';
import {
  agruparCompras,
  detectarCabecalho,
  detectarColunas,
  lerLinhas,
  marcarDuplicadas,
  normalizar,
  problemasDaImportacao,
  type CompraImportada,
  type Destino,
  type LinhaLida,
} from '@/domain/importacao';
import { CORES_DE_CARTAO } from '@/features/cadastros/opcoes';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { lerPlanilha, PlanilhaInvalida, type PlanilhaLida } from './lerPlanilha';
import { PassoArquivo } from './PassoArquivo';
import { PassoColunas } from './PassoColunas';
import { PassoConfirmar } from './PassoConfirmar';
import { PassoPrevia } from './PassoPrevia';

export interface ConfigDaAba {
  importar: boolean;
  cabecalho: number;
  destinos: Destino[];
  detectadas: boolean[];
  cartaoDaAba: string | null;
}

export interface Revisao {
  correcoes: Record<string, Partial<Pick<LinhaLida, 'valor' | 'data' | 'parcela' | 'dono'>>>;
  ignoradas: string[];
  divisoesAceitas: string[];
  valoresAceitos: string[];
  diasDosNovos: Record<string, { diaFechamento: number; diaVencimento: number }>;
  forcarDuplicadas: string[];
}

interface Cadastros {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  categorias: Categoria[];
  existentes: { dataCompra: string; cartao: string; descricao: string; valorTotal: number }[];
  historico: { descricao: string; categoriaId: number }[];
}

const REVISAO_VAZIA: Revisao = {
  correcoes: {},
  ignoradas: [],
  divisoesAceitas: [],
  valoresAceitos: [],
  diasDosNovos: {},
  forcarDuplicadas: [],
};

const PASSOS = ['Arquivo', 'Abas e colunas', 'Prévia', 'Confirmar'];
const TITULOS = [
  ['Traga sua planilha', 'O Fechô lê o arquivo aqui mesmo, sem enviar nada para a internet.'],
  [
    'Confira as abas e colunas',
    'Diga o que cada coluna significa. As que reconhecemos já vêm marcadas.',
  ],
  ['Veja antes de importar', 'Nada é corrigido sem você decidir.'],
  ['Tudo certo?', 'Revise o resumo e importe.'],
] as const;

export const OBRIGATORIAS: [Destino, string][] = [
  ['data', 'Data'],
  ['descricao', 'Descrição'],
  ['valor', 'Valor'],
];

function configInicial(planilha: PlanilhaLida, cartoes: Cartao[]): ConfigDaAba[] {
  return planilha.abas.map((aba) => {
    const cabecalho = detectarCabecalho(aba.linhas);
    const colunas = detectarColunas(aba.linhas[cabecalho] ?? []);
    const destinos = colunas.map((c) => c.destino);
    const existente = cartoes.find((c) => normalizar(c.nome) === normalizar(aba.nome));
    return {
      importar: OBRIGATORIAS.filter(([d]) => destinos.includes(d)).length >= 2,
      cabecalho,
      destinos,
      detectadas: colunas.map((c) => c.detectada),
      cartaoDaAba: destinos.includes('cartao') ? null : (existente?.nome ?? aba.nome),
    };
  });
}

export function faltasDaAba(config: ConfigDaAba): string[] {
  const faltas = OBRIGATORIAS.filter(([d]) => !config.destinos.includes(d)).map(([, nome]) => nome);
  if (!config.destinos.includes('cartao') && !config.cartaoDaAba) faltas.push('Cartão');
  return faltas;
}

function montarDados(
  compras: CompraImportada[],
  ids: {
    cartao: (nome: string) => number;
    pessoa: (nome: string) => number | null;
    categoria: (compra: CompraImportada) => number | null;
  },
): DadosNovaCompra[] {
  return compras.map((compra) => {
    const dono = compra.dono;
    const pessoas = dono.tipo === 'pessoa' ? [dono.nome] : dono.tipo === 'varias' ? dono.nomes : [];
    const comId = pessoas.flatMap((nome) => {
      const id = ids.pessoa(nome);
      return id === null ? [] : [id];
    });
    const partes = comId.length + (dono.tipo === 'varias' && dono.incluiMeu ? 1 : 0);
    const cada = partes > 0 ? Math.floor(100 / partes) : 0;
    return {
      cartaoId: ids.cartao(compra.cartao),
      descricao: compra.descricao,
      categoriaId: ids.categoria(compra),
      valorTotal: compra.valorTotal,
      numParcelas: compra.numParcelas,
      dataCompra: compra.dataCompra,
      recorrente: dono.tipo === 'recorrente',
      rateios:
        comId.length === 0
          ? []
          : comId.length === 1 && partes === 1
            ? rateioDaCompra('outra', [{ terceiroId: comId[0] ?? 0, percentual: 100 }])
            : rateioDaCompra(
                'dividida',
                comId.map((terceiroId) => ({ terceiroId, percentual: cada })),
              ),
    };
  });
}

export function Importacao() {
  const repos = useRepositorios();
  const navigate = useNavigate();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [passo, setPasso] = useState(() => (useApp.getState().planilhaArrastada ? 2 : 1));
  const [cadastros, setCadastros] = useState<Cadastros | null>(null);
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(
    () => useApp.getState().planilhaArrastada,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [config, setConfig] = useState<ConfigDaAba[]>([]);
  const [abaAtual, setAbaAtual] = useState(0);
  const [revisao, setRevisao] = useState<Revisao>(REVISAO_VAZIA);
  const [criarPessoas, setCriarPessoas] = useState(true);
  const [sugerirCategorias, setSugerirCategorias] = useState(true);
  const [estado, setEstado] = useState<'pronto' | 'importando' | 'feito'>('pronto');
  const [resultado, setResultado] = useState({ compras: 0, parcelas: 0, pessoas: 0 });

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.cartoes.listar(),
      repos.terceiros.listar(),
      repos.categorias.listar(),
      repos.compras.listar(),
      repos.compras.ultimasCategorias(),
    ]).then(([cartoes, terceiros, categorias, compras, historico]) => {
      if (!montado) return;
      const arrastada = useApp.getState().planilhaArrastada;
      if (arrastada) {
        setConfig(configInicial(arrastada, cartoes));
        useApp.getState().receberPlanilha(null);
      }
      setCadastros({
        cartoes,
        terceiros,
        categorias,
        historico,
        existentes: compras.map((c) => ({
          ...c,
          cartao: cartoes.find((cartao) => cartao.id === c.cartaoId)?.nome ?? '',
        })),
      });
    });
    return () => {
      montado = false;
    };
  }, [repos]);

  const abrirArquivo = async (arquivo: File) => {
    setLendo(true);
    setErro(null);
    try {
      const lida = await lerPlanilha(arquivo);
      setPlanilha(lida);
      setConfig(configInicial(lida, cadastros?.cartoes ?? []));
      setAbaAtual(0);
      setRevisao(REVISAO_VAZIA);
    } catch (e) {
      setPlanilha(null);
      setErro(e instanceof PlanilhaInvalida ? e.message : 'Não deu para ler esse arquivo.');
    } finally {
      setLendo(false);
    }
  };

  if (!cadastros) return null;

  const cartoesExistentes = cadastros.cartoes.map((c) => c.nome);
  const linhas = planilha
    ? planilha.abas.flatMap((aba, i) => {
        const c = config[i];
        if (!c?.importar) return [];
        return lerLinhas({
          aba: aba.nome,
          inicio: c.cabecalho,
          linhas: aba.linhas.slice(c.cabecalho + 1),
          destinos: c.destinos,
          cartaoDaAba: c.cartaoDaAba,
        });
      })
    : [];
  const efetivas = linhas
    .filter((l) => !revisao.ignoradas.includes(l.id))
    .map((l) => ({ ...l, ...revisao.correcoes[l.id] }));
  const agrupadas = agruparCompras(efetivas);
  const duplicadas = marcarDuplicadas(agrupadas, cadastros.existentes);
  const compras = agrupadas.filter(
    (c) => !duplicadas.has(c.chave) || revisao.forcarDuplicadas.includes(c.chave),
  );
  const problemas = problemasDaImportacao(efetivas, agrupadas, cartoesExistentes).filter(
    (p) =>
      !(p.tipo === 'divisao' && revisao.divisoesAceitas.includes(p.chave)) &&
      !(p.tipo === 'valoresDiferentes' && revisao.valoresAceitos.includes(p.chave)) &&
      !(p.tipo === 'cartaoNovo' && p.chave in revisao.diasDosNovos),
  );
  const abasImportadas = config.filter((c) => c.importar);
  const configOk =
    abasImportadas.length > 0 && abasImportadas.every((c) => faltasDaAba(c).length === 0);

  const novasPessoas = [
    ...new Set(
      compras.flatMap((c) =>
        c.dono.tipo === 'pessoa' ? [c.dono.nome] : c.dono.tipo === 'varias' ? c.dono.nomes : [],
      ),
    ),
  ].filter((nome) => !cadastros.terceiros.some((t) => normalizar(t.nome) === normalizar(nome)));
  const novosCartoes = [...new Set(compras.map((c) => c.cartao))].filter(
    (nome) => !cartoesExistentes.some((e) => normalizar(e) === normalizar(nome)),
  );

  const bloqueio =
    passo === 1
      ? planilha
        ? null
        : 'Escolha um arquivo para continuar'
      : passo === 2
        ? configOk
          ? null
          : 'Marque ao menos uma aba e as colunas de data, descrição e valor'
        : passo === 3
          ? problemas.length > 0
            ? `Resolva ${problemas.length === 1 ? 'o ponto' : `os ${problemas.length} pontos`} para continuar`
            : compras.length === 0
              ? 'Não há compras para importar'
              : null
          : null;

  const importar = () =>
    executar(async () => {
      setEstado('importando');
      const criados = {
        cartoes: [] as number[],
        terceiros: [] as number[],
        categorias: [] as number[],
      };
      const idDoCartao = new Map(cadastros.cartoes.map((c) => [normalizar(c.nome), c.id]));
      for (const [i, nome] of novosCartoes.entries()) {
        const dias = revisao.diasDosNovos[nome] ?? { diaFechamento: 1, diaVencimento: 10 };
        const id = await repos.cartoes.criar({
          nome,
          ...dias,
          limiteCentavos: 0,
          cor:
            CORES_DE_CARTAO[(cadastros.cartoes.length + i) % CORES_DE_CARTAO.length]?.hex ??
            '#57534E',
          ativo: true,
        });
        criados.cartoes.push(id);
        idDoCartao.set(normalizar(nome), id);
      }
      const idDaPessoa = new Map(cadastros.terceiros.map((t) => [normalizar(t.nome), t.id]));
      if (criarPessoas) {
        for (const nome of novasPessoas) {
          const id = await repos.terceiros.criar({ nome, cor: '#2563EB', ativo: true });
          criados.terceiros.push(id);
          idDaPessoa.set(normalizar(nome), id);
        }
      }
      const categorias = [...cadastros.categorias];
      for (const nome of new Set(compras.flatMap((c) => (c.categoria ? [c.categoria] : [])))) {
        if (categorias.some((c) => normalizar(c.nome) === normalizar(nome))) continue;
        const id = await repos.categorias.criar({ nome, icone: 'tag', ativo: true });
        criados.categorias.push(id);
        categorias.push({ id, nome, icone: 'tag', ativo: true });
      }

      const ids = await repos.compras.importar(
        montarDados(compras, {
          cartao: (nome) => idDoCartao.get(normalizar(nome)) ?? 0,
          pessoa: (nome) => idDaPessoa.get(normalizar(nome)) ?? null,
          categoria: (compra) =>
            compra.categoria
              ? (categorias.find((c) => normalizar(c.nome) === normalizar(compra.categoria ?? ''))
                  ?.id ?? null)
              : sugerirCategorias
                ? sugerirCategoria(compra.descricao, cadastros.historico, categorias)
                : null,
        }),
      );

      dadosMudaram();
      setResultado({
        compras: ids.length,
        parcelas: compras.reduce((s, c) => s + c.numParcelas, 0),
        pessoas: criados.terceiros.length,
      });
      setEstado('feito');
      toast.success(
        `${ids.length} ${ids.length === 1 ? 'compra importada' : 'compras importadas'}`,
        {
          action: {
            label: 'Desfazer',
            onClick: () =>
              void executar(async () => {
                for (const id of ids) await repos.compras.excluir(id);
                for (const id of criados.cartoes) await repos.cartoes.excluir(id);
                for (const id of criados.terceiros) await repos.terceiros.excluir(id);
                for (const id of criados.categorias) await repos.categorias.excluir(id);
                dadosMudaram();
              }),
          },
        },
      );
    }).finally(() => {
      setEstado((atual) => (atual === 'importando' ? 'pronto' : atual));
    });

  const [titulo, legenda] =
    estado === 'feito' ? ['Tudo pronto!', ''] : (TITULOS[passo - 1] ?? TITULOS[0]);
  const legendasDosPassos = [
    planilha?.nome ?? '.xlsx ou .csv',
    planilha ? `${abasImportadas.length} de ${planilha.abas.length} abas` : '',
    passo >= 3
      ? problemas.length > 0
        ? `${problemas.length} ${problemas.length === 1 ? 'ponto' : 'pontos'} para revisar`
        : 'Revisado'
      : '',
    passo >= 3 ? `${compras.length} compras` : '',
  ];

  return (
    <div className="flex h-screen gap-6 bg-background p-6">
      <aside className="flex w-[320px] flex-none flex-col gap-8 rounded-lg border bg-surface p-6">
        <div className="flex items-center gap-2">
          <LogoSimbolo size={32} className="text-brand" />
          <span className="text-2xl font-bold tracking-[-0.025em]">Fechô</span>
        </div>
        <p className="text-sm text-ink-muted">
          Finanças pessoais em dia: o que é seu, o que é dos outros, e o mês fechado.
        </p>
        <ol aria-label="Passos da importação" className="flex flex-col gap-4">
          {PASSOS.map((rotulo, i) => {
            const n = i + 1;
            const feito = estado === 'feito' || n < passo;
            const atual = n === passo && estado !== 'feito';
            return (
              <li
                key={rotulo}
                aria-current={atual ? 'step' : undefined}
                className="flex items-start gap-3"
              >
                <span
                  className={cn(
                    'flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold',
                    feito && 'bg-brand text-on-brand',
                    atual && 'border-2 border-ink',
                    !feito && !atual && 'border border-border-strong text-ink-muted',
                  )}
                >
                  {feito ? <Check size={14} strokeWidth={2} aria-hidden /> : n}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      'text-sm',
                      atual ? 'font-semibold' : 'font-medium',
                      !feito && !atual && 'text-ink-muted',
                    )}
                  >
                    {rotulo}
                  </span>
                  <span className="truncate text-xs text-ink-muted">{legendasDosPassos[i]}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-auto flex items-start gap-2 text-xs text-ink-muted">
          <Lock size={14} strokeWidth={1.75} aria-hidden className="mt-px flex-none" />
          Seus dados ficam só neste computador. Nada vai para a internet.
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col rounded-lg border bg-surface">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-12 py-10">
          <header className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-brand-text">
              {estado === 'feito' ? 'Importação concluída' : `Passo ${passo} de 4`}
            </span>
            <h1 className="text-[28px] leading-[34px] font-semibold">{titulo}</h1>
            {legenda && <p className="text-sm text-ink-muted">{legenda}</p>}
          </header>

          {passo === 1 && (
            <PassoArquivo
              planilha={planilha}
              erro={erro}
              lendo={lendo}
              onArquivo={(arquivo) => void abrirArquivo(arquivo)}
              onTrocar={() => {
                setPlanilha(null);
              }}
            />
          )}
          {passo === 2 && planilha && (
            <PassoColunas
              planilha={planilha}
              config={config}
              abaAtual={abaAtual}
              cartoes={cadastros.cartoes}
              onAbaAtual={setAbaAtual}
              onConfig={(i, mudanca) => {
                setConfig((atual) => atual.map((c, j) => (j === i ? { ...c, ...mudanca } : c)));
                setRevisao(REVISAO_VAZIA);
              }}
            />
          )}
          {passo === 3 && (
            <PassoPrevia
              linhas={efetivas}
              compras={compras}
              problemas={problemas}
              duplicadas={agrupadas.filter((c) => duplicadas.has(c.chave))}
              revisao={revisao}
              novosCartoes={novosCartoes}
              novasPessoas={novasPessoas}
              onRevisao={(mudanca) => {
                setRevisao((atual) => ({ ...atual, ...mudanca(atual) }));
              }}
            />
          )}
          {passo === 4 && (
            <PassoConfirmar
              compras={compras}
              novosCartoes={novosCartoes}
              novasPessoas={novasPessoas}
              criarPessoas={criarPessoas}
              sugerirCategorias={sugerirCategorias}
              temColunaDeCategoria={abasImportadas.some((c) => c.destinos.includes('categoria'))}
              estado={estado}
              resultado={resultado}
              onCriarPessoas={setCriarPessoas}
              onSugerirCategorias={setSugerirCategorias}
            />
          )}
        </div>

        <footer className="flex items-center gap-2 border-t px-12 py-4">
          {estado === 'feito' ? (
            <Button className="ml-auto" onClick={() => void navigate('/lancamentos')}>
              Abrir o Fechô
            </Button>
          ) : (
            <>
              {passo > 1 && (
                <Button
                  variant="outline"
                  disabled={estado === 'importando'}
                  onClick={() => {
                    setPasso((p) => p - 1);
                  }}
                >
                  Voltar
                </Button>
              )}
              <span className="flex-1 text-right text-xs text-ink-muted" id="motivo-do-bloqueio">
                {bloqueio}
              </span>
              <Button
                variant="ghost"
                onClick={() => void navigate(-1)}
                disabled={estado === 'importando'}
              >
                Cancelar
              </Button>
              <Button
                aria-disabled={bloqueio !== null || estado === 'importando' ? true : undefined}
                aria-describedby={bloqueio ? 'motivo-do-bloqueio' : undefined}
                onClick={() => {
                  if (bloqueio || estado === 'importando') return;
                  if (passo < 4) setPasso((p) => p + 1);
                  else void importar();
                }}
              >
                {passo < 4
                  ? 'Continuar'
                  : estado === 'importando'
                    ? 'Importando…'
                    : `Importar ${compras.length} ${compras.length === 1 ? 'compra' : 'compras'}`}
              </Button>
            </>
          )}
        </footer>
      </main>
    </div>
  );
}
