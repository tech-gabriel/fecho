import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { salvarPlanilha } from '@/data/backup';
import { abasDaExportacao } from '@/domain/exportacao';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { nomeDoMes } from '@/lib/formato';
import { gerarPlanilha } from './gerarPlanilha';

export function useExportarPlanilha() {
  const repos = useRepositorios();
  const competencia = useApp((s) => s.competencia);

  return useCallback(
    () =>
      executar(async () => {
        const mes = nomeDoMes(competencia).split(' ')[0] ?? '';
        const [cartoes, terceiros, categorias, parcelas] = await Promise.all([
          repos.cartoes.listar(),
          repos.terceiros.listar(),
          repos.categorias.listar(),
          repos.compras.parcelasDaCompetencia(competencia),
        ]);
        const abas = abasDaExportacao(parcelas, { cartoes, terceiros, categorias });
        if (abas.length === 0) {
          toast.info(`Nada lançado em ${mes} para exportar.`);
          return;
        }
        const salvo = await salvarPlanilha(`fecho-${competencia}.xlsx`, await gerarPlanilha(abas));
        if (salvo) toast.success(`Planilha de ${mes} exportada`);
      }),
    [repos, competencia],
  );
}
