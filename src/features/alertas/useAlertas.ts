import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import type {
  Cartao,
  Movimento,
  PagamentoDeFatura,
  ParcelaDoMes,
  Preferencias,
  Terceiro,
} from '@/data';
import { alertasDoDia, type Alerta } from '@/domain/alertas';
import { competenciaDe, somarMeses, type DataLocal } from '@/domain/competencia';
import { montarFaturas } from '@/features/faturas/Faturas';
import { faltaNaFatura, montarSituacoes } from '@/features/receber/situacoes';
import { notificarNoWindows } from './notificar';
import { textoDoAlerta } from './textos';

const UMA_HORA = 60 * 60 * 1000;
// C−2 cobre atrasos de até 30 dias; C+1 cobre o fechamento que cai no mês seguinte
const MESES_OLHADOS = [-2, -1, 0, 1];

interface Dados {
  cartoes: Cartao[];
  terceiros: Terceiro[];
  porMes: ParcelaDoMes[][];
  pagamentos: PagamentoDeFatura[];
  deTerceiros: ParcelaDoMes[];
  movimentos: Movimento[];
  preferencias: Preferencias;
}

export interface AlertaNaTela extends Alerta {
  texto: string;
  cartao: Cartao;
  terceiro: Terceiro | undefined;
  lido: boolean;
}

function calcular(dados: Dados, hoje: DataLocal): AlertaNaTela[] {
  const atual = competenciaDe(hoje);
  const situacoes = montarSituacoes({
    ...dados,
    parcelas: dados.deTerceiros,
    competencia: somarMeses(atual, 1),
    hoje,
  });
  const faturas = MESES_OLHADOS.flatMap((n, i) =>
    montarFaturas({ ...dados, parcelas: dados.porMes[i] ?? [] }, somarMeses(atual, n), hoje).map(
      (f) => ({
        cartaoId: f.cartao.id,
        competencia: f.competencia,
        vencimento: f.vencimento,
        total: f.resumo.total,
        paga: f.pagamento !== undefined,
        faltaPorTerceiro: faltaNaFatura(situacoes, f.cartao.id, f.competencia).map(
          ({ terceiro, falta }) => ({ terceiroId: terceiro.id, falta }),
        ),
      }),
    ),
  );
  const lidos = new Set(dados.preferencias.alertasLidos);
  return alertasDoDia(
    faturas,
    dados.cartoes.filter((c) => c.ativo),
    hoje,
    dados.preferencias.alertasDesligados,
  ).flatMap((alerta) => {
    const cartao = dados.cartoes.find((c) => c.id === alerta.cartaoId);
    if (!cartao) return [];
    const terceiro = dados.terceiros.find((t) => t.id === alerta.terceiroId);
    return [
      {
        ...alerta,
        cartao,
        terceiro,
        texto: textoDoAlerta(alerta, { cartao: cartao.nome, terceiro: terceiro?.nome }),
        lido: lidos.has(alerta.chave),
      },
    ];
  });
}

export function useAlertas() {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const [hoje, setHoje] = useState(hojeLocal);
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    const relogio = setInterval(() => {
      setHoje(hojeLocal());
    }, UMA_HORA);
    return () => {
      clearInterval(relogio);
    };
  }, []);

  useEffect(() => {
    let montado = true;
    const atual = competenciaDe(hoje);
    void Promise.all([
      repos.cartoes.listar(),
      repos.terceiros.listar(),
      Promise.all(
        MESES_OLHADOS.map((n) => repos.compras.parcelasDaCompetencia(somarMeses(atual, n))),
      ),
      repos.faturas.pagamentos(),
      repos.compras.parcelasDeTerceiros(somarMeses(atual, 1)),
      repos.receber.movimentos(),
      repos.preferencias.ler(),
    ]).then(([cartoes, terceiros, porMes, pagamentos, deTerceiros, movimentos, preferencias]) => {
      if (montado) {
        setDados({ cartoes, terceiros, porMes, pagamentos, deTerceiros, movimentos, preferencias });
      }
    });
    return () => {
      montado = false;
    };
  }, [repos, versao, hoje]);

  const alertas = useMemo(() => (dados ? calcular(dados, hoje) : []), [dados, hoje]);

  useEffect(() => {
    if (!dados?.preferencias.notificarNoWindows) return;
    const { alertasNotificados } = dados.preferencias;
    const pendentes = alertas.filter((a) => !a.lido && !alertasNotificados.includes(a.chave));
    if (pendentes.length === 0) return;
    void notificarNoWindows(pendentes).then((enviados) => {
      if (enviados.length === 0) return;
      const atuais = new Set(alertas.map((a) => a.chave));
      const notificados = [...new Set([...alertasNotificados, ...enviados])].filter((k) =>
        atuais.has(k),
      );
      void repos.preferencias.gravar({ alertasNotificados: notificados });
    });
  }, [repos, dados, alertas]);

  const marcarComoLidos = useCallback(
    (chaves: readonly string[]) => {
      if (!dados) return;
      const alertasLidos = alertas
        .filter((a) => a.lido || chaves.includes(a.chave))
        .map((a) => a.chave);
      setDados({ ...dados, preferencias: { ...dados.preferencias, alertasLidos } });
      void repos.preferencias.gravar({ alertasLidos });
    },
    [repos, dados, alertas],
  );

  return { alertas, hoje, preferencias: dados?.preferencias, marcarComoLidos };
}
