import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import type {
  Cartao,
  Categoria,
  Movimento,
  PagamentoDeFatura,
  ParcelaDoMes,
  Terceiro,
} from '@/data';
import type { Competencia, DataLocal } from '@/domain/competencia';
import {
  datasDaFatura,
  linhasPorDono,
  resumoDaFatura,
  statusDaFatura,
  type LinhaDaFatura,
  type StatusDaFatura,
} from '@/domain/faturas';
import { faltaNaFatura, montarSituacoes } from '@/features/receber/situacoes';
import { nomeDoMes } from '@/lib/formato';
import { DetalheDaFatura } from './DetalheDaFatura';
import { dataCurta, ListaDeCartoes } from './ListaDeCartoes';

export interface FaturaDoCartao {
  cartao: Cartao;
  competencia: Competencia;
  parcelas: ParcelaDoMes[];
  linhas: LinhaDaFatura[];
  resumo: ReturnType<typeof resumoDaFatura>;
  fechamento: DataLocal;
  vencimento: DataLocal;
  pagamento: PagamentoDeFatura | undefined;
  status: StatusDaFatura;
}

interface Dados {
  cartoes: Cartao[];
  categorias: Categoria[];
  terceiros: Terceiro[];
  parcelas: ParcelaDoMes[];
  pagamentos: PagamentoDeFatura[];
  deTerceiros: ParcelaDoMes[];
  movimentos: Movimento[];
}

export type Filtro = 'meu' | 'terceiros' | 'todos';

export function montarFaturas(
  dados: Pick<Dados, 'cartoes' | 'parcelas' | 'pagamentos'>,
  competencia: Competencia,
  hoje: DataLocal,
) {
  return dados.cartoes.flatMap((cartao): FaturaDoCartao[] => {
    const parcelas = dados.parcelas.filter((p) => p.cartaoId === cartao.id);
    if (!cartao.ativo && parcelas.length === 0) return [];
    const linhas = linhasPorDono(parcelas);
    const { fechamento, vencimento } = datasDaFatura(competencia, cartao);
    const pagamento = dados.pagamentos.find(
      (p) => p.cartaoId === cartao.id && p.competencia === competencia,
    );
    return [
      {
        cartao,
        competencia,
        parcelas,
        linhas,
        resumo: resumoDaFatura(linhas),
        fechamento,
        vencimento,
        pagamento,
        status: statusDaFatura({ vencimento, pagoEm: pagamento?.pagoEm ?? null }, hoje),
      },
    ];
  });
}

function legendaDoMes(faturas: FaturaDoCartao[], competencia: Competencia) {
  const abertas = faturas.filter((f) => f.resumo.total > 0 && f.status !== 'paga');
  const mes = nomeDoMes(competencia);
  if (abertas.length === 0) return `${mes} · nenhuma fatura em aberto`;
  const ultimo =
    abertas
      .map((f) => f.vencimento)
      .sort()
      .at(-1) ?? '';
  return abertas.length === 1
    ? `${mes} · 1 fatura aberta, vence em ${dataCurta(ultimo)}`
    : `${mes} · ${abertas.length} faturas abertas, vencem até ${dataCurta(ultimo)}`;
}

export function Faturas() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const definirLegenda = useApp((s) => s.definirLegenda);
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useSearchParams();
  const navigate = useNavigate();
  const hoje = hojeLocal();

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.cartoes.listar(),
      repos.categorias.listar(),
      repos.terceiros.listar(),
      repos.compras.parcelasDaCompetencia(competencia),
      repos.faturas.pagamentos(),
      repos.compras.parcelasDeTerceiros(competencia),
      repos.receber.movimentos(),
    ]).then(([cartoes, categorias, terceiros, parcelas, pagamentos, deTerceiros, movimentos]) => {
      if (montado) {
        setDados({ cartoes, categorias, terceiros, parcelas, pagamentos, deTerceiros, movimentos });
      }
    });
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao]);

  const faturas = dados ? montarFaturas(dados, competencia, hoje) : [];
  const legenda = dados ? legendaDoMes(faturas, competencia) : null;

  useEffect(() => {
    definirLegenda(legenda);
  }, [definirLegenda, legenda]);

  useEffect(
    () => () => {
      definirLegenda(null);
    },
    [definirLegenda],
  );

  if (!dados) return null;

  if (faturas.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-soft">
          <CreditCard size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
        </span>
        <p className="text-sm text-ink-muted">Você ainda não cadastrou nenhum cartão.</p>
        <Button onClick={() => void navigate('/configuracoes')}>Adicionar cartão</Button>
      </div>
    );
  }

  const idEscolhido = Number(busca.get('cartao'));
  const escolhida = faturas.find((f) => f.cartao.id === idEscolhido) ?? faturas[0];
  const situacoes = montarSituacoes({
    ...dados,
    parcelas: dados.deTerceiros,
    competencia,
    hoje,
  });
  const ver = busca.get('ver');
  const filtro: Filtro = ver === 'meu' || ver === 'terceiros' ? ver : 'todos';

  const atualizar = (mudanca: Record<string, string>) => {
    setBusca(
      (atual) => {
        const nova = new URLSearchParams(atual);
        for (const [chave, valor] of Object.entries(mudanca)) nova.set(chave, valor);
        return nova;
      },
      { replace: true },
    );
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)] gap-4">
      <ListaDeCartoes
        faturas={faturas}
        escolhida={escolhida?.cartao.id}
        hoje={hoje}
        onEscolher={(id) => {
          atualizar({ cartao: String(id) });
        }}
      />
      {escolhida && (
        <DetalheDaFatura
          fatura={escolhida}
          categorias={dados.categorias}
          terceiros={dados.terceiros}
          faltas={faltaNaFatura(situacoes, escolhida.cartao.id, competencia)}
          filtro={filtro}
          hoje={hoje}
          onFiltro={(novo) => {
            atualizar({ ver: novo });
          }}
        />
      )}
    </div>
  );
}
