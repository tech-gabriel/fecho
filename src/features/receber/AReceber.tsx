import { useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import type {
  EmprestimoConcedido,
  Cartao,
  ContaFixa,
  PagamentoDeConta,
  Movimento,
  ParcelaDoMes,
  Preferencias,
  Terceiro,
} from '@/data';
import { DetalheDaPessoa } from './DetalheDaPessoa';
import { ListaDePessoas } from './ListaDePessoas';
import { montarSituacoes } from './situacoes';

interface Dados {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  parcelas: ParcelaDoMes[];
  movimentos: Movimento[];
  preferencias: Preferencias;
  concedidos: EmprestimoConcedido[];
  contasFixas: { contas: ContaFixa[]; pagamentos: PagamentoDeConta[] };
}

const ORDEM = { atrasado: 0, parcial: 1, pendente: 2, pago: 3 };

export function AReceber() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);
  const versao = useApp((s) => s.versaoDosDados);
  const [dados, setDados] = useState<Dados | null>(null);
  const [busca, setBusca] = useSearchParams();
  const hoje = hojeLocal();

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.cartoes.listar(),
      repos.terceiros.listar(),
      repos.compras.parcelasDeTerceiros(competencia),
      repos.receber.movimentos(),
      repos.preferencias.ler(),
      repos.emprestimos.concedidos.listar(),
      repos.contasFixas.listar(),
      repos.contasFixas.pagamentos(),
    ]).then(
      ([
        cartoes,
        terceiros,
        parcelas,
        movimentos,
        preferencias,
        concedidos,
        contas,
        pagamentos,
      ]) => {
        if (montado) {
          setDados({
            cartoes,
            terceiros,
            parcelas,
            movimentos,
            preferencias,
            concedidos,
            contasFixas: { contas, pagamentos },
          });
        }
      },
    );
    return () => {
      montado = false;
    };
  }, [repos, competencia, versao]);

  if (!dados) return null;

  const situacoes = montarSituacoes({ ...dados, competencia, hoje })
    .filter((s) => s.total > 0 || s.depositado > 0)
    .sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || b.falta - a.falta);

  if (situacoes.every((s) => s.falta === 0 && s.credito === 0)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-soft">
          <HandCoins size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
        </span>
        <p className="text-sm text-ink-muted">Ninguém te deve nada neste mês.</p>
      </div>
    );
  }

  const idEscolhido = Number(busca.get('pessoa'));
  const escolhida = situacoes.find((s) => s.terceiro.id === idEscolhido) ?? situacoes[0];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[288px_minmax(0,1fr)] gap-4">
      <ListaDePessoas
        situacoes={situacoes}
        cartoes={dados.cartoes}
        escolhida={escolhida?.terceiro.id}
        onEscolher={(id) => {
          setBusca({ pessoa: String(id) }, { replace: true });
        }}
      />
      {escolhida && (
        <DetalheDaPessoa
          key={escolhida.terceiro.id}
          situacao={escolhida}
          cartoes={dados.cartoes}
          preferencias={dados.preferencias}
          competencia={competencia}
          hoje={hoje}
        />
      )}
    </div>
  );
}
