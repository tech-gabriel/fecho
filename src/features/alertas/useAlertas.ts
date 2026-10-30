import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import type {
  Assinatura,
  Cartao,
  Categoria,
  ContaFixa,
  PagamentoDeConta,
  Preferencias,
  Terceiro,
} from '@/data';
import { alertasDoDia, type Alerta } from '@/domain/alertas';
import { competenciaDe, somarMeses, type DataLocal } from '@/domain/competencia';
import { alertasDeContas } from '@/domain/contasFixas';
import { alertasDeOrcamento, situacaoDoOrcamento } from '@/domain/orcamento';
import {
  carregarFaturas,
  emprestimosParaAlerta,
  faturasParaAlerta,
  type FaturasCarregadas,
} from './faturas';
import { notificarNoWindows } from './notificar';
import { textoDoAlerta } from './textos';

const UMA_HORA = 60 * 60 * 1000;
// C−2 cobre atrasos de até 30 dias; C+1 cobre o fechamento que cai no mês seguinte
const MESES_OLHADOS = [-2, -1, 0, 1];

interface Dados extends FaturasCarregadas {
  preferencias: Preferencias;
  assinaturas: Assinatura[];
  categorias: Categoria[];
  contas: ContaFixa[];
  pagamentosDeConta: PagamentoDeConta[];
  fechados: string[];
}

export interface AlertaNaTela extends Alerta {
  texto: string;
  cartao: Cartao | undefined;
  terceiro: Terceiro | undefined;
  conta: ContaFixa | undefined;
  lido: boolean;
}

function calcular(dados: Dados, hoje: DataLocal): AlertaNaTela[] {
  const faturas = faturasParaAlerta(dados, hoje);
  const lidos = new Set(dados.preferencias.alertasLidos);
  const { alertasDesligados } = dados.preferencias;
  const atual = competenciaDe(hoje);
  const deOrcamento = alertasDesligados.includes('orcamento')
    ? []
    : [atual, somarMeses(atual, 1)].flatMap((competencia) =>
        alertasDeOrcamento(
          situacaoDoOrcamento(
            dados.categorias,
            dados.porMes.find((m) => m.competencia === competencia)?.parcelas ?? [],
          ),
          competencia,
          hoje,
        ),
      );
  const deContas = alertasDesligados.includes('conta-fixa')
    ? []
    : alertasDeContas(dados.contas, dados.pagamentosDeConta, hoje);
  return [
    ...deOrcamento,
    ...deContas,
    ...alertasDoDia(
      faturas,
      dados.cartoes.filter((c) => c.ativo),
      hoje,
      alertasDesligados,
      dados.assinaturas,
      emprestimosParaAlerta(dados, hoje),
      new Set(dados.fechados),
    ),
  ]
    .sort((a, b) => a.idade - b.idade)
    .flatMap((alerta) => {
      const conta = dados.contas.find((c) => c.id === alerta.contaId);
      const cartao = dados.cartoes.find((c) => c.id === alerta.cartaoId);
      if (!cartao && alerta.cartaoId !== 0) return [];
      const terceiro = dados.terceiros.find((t) => t.id === alerta.terceiroId);
      const tomado = dados.tomados.find((e) => e.id === alerta.emprestimoId);
      return [
        {
          ...alerta,
          cartao,
          terceiro,
          conta,
          texto: textoDoAlerta(alerta, {
            conta: conta?.descricao,
            cartao: cartao?.nome ?? '',
            emprestimo: tomado
              ? { descricao: tomado.descricao, numParcelas: tomado.numParcelas }
              : undefined,
            terceiro: terceiro?.nome,
            assinatura: dados.assinaturas.find((a) => a.id === alerta.assinaturaId)?.nome,
            categoria: dados.categorias.find((c) => c.id === alerta.categoriaId)?.nome,
          }),
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
      carregarFaturas(
        repos,
        MESES_OLHADOS.map((n) => somarMeses(atual, n)),
      ),
      repos.preferencias.ler(),
      repos.assinaturas.listar(),
      repos.categorias.listar(),
      repos.contasFixas.listar(),
      repos.contasFixas.pagamentos(),
      repos.fechamento.fechados(),
    ]).then(
      ([faturas, preferencias, assinaturas, categorias, contas, pagamentosDeConta, fechados]) => {
        if (montado)
          setDados({
            ...faturas,
            preferencias,
            assinaturas,
            categorias,
            contas,
            pagamentosDeConta,
            fechados,
          });
      },
    );
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
