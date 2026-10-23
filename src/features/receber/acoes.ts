import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import type { Preferencias, Terceiro } from '@/data';
import { competenciaDe, type DataLocal } from '@/domain/competencia';
import { distribuir, mensagemDeCobranca, type ItemComSituacao } from '@/domain/receber';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda } from '@/lib/formato';

export function useAcoesDeCobranca(preferencias: Preferencias, hoje: DataLocal) {
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);

  const registrarDeposito = async (
    terceiro: Terceiro,
    valor: number,
    escolhidos: ItemComSituacao[],
  ) => {
    let id = 0;
    await executar(async () => {
      id = await repos.receber.registrarDeposito({
        terceiroId: terceiro.id,
        valorCentavos: valor,
        data: hoje,
        competencia: competenciaDe(hoje),
        abatimentos: distribuir(valor, escolhidos).abatimentos,
      });
      dadosMudaram();
    });
    if (!id) return false;
    toast.success(`Depósito de ${formatarMoeda(valor)} registrado`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await repos.receber.excluir(id);
            dadosMudaram();
          }),
      },
    });
    return true;
  };

  const copiarCobranca = async (
    terceiro: Terceiro,
    {
      valor,
      cartao,
      vencimento,
    }: { valor: number; cartao: string | null; vencimento: DataLocal | null },
    aoCopiar: () => void,
  ): Promise<void> => {
    const texto = mensagemDeCobranca(preferencias.modeloCobranca, {
      nome: terceiro.nome,
      valor: formatarMoeda(valor),
      cartao,
      vencimento: vencimento ? dataCurta(vencimento) : '',
      pix: preferencias.chavePix,
    });
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      toast.error('Não foi possível copiar a cobrança.', {
        action: {
          label: 'Tentar de novo',
          onClick: () => void copiarCobranca(terceiro, { valor, cartao, vencimento }, aoCopiar),
        },
      });
      return;
    }
    aoCopiar();
    toast.success(`Cobrança para ${terceiro.nome} copiada. É só colar no WhatsApp.`);
    await executar(async () => {
      await repos.receber.registrarCobranca({
        terceiroId: terceiro.id,
        valorCentavos: valor,
        data: hoje,
        competencia: competenciaDe(hoje),
      });
      dadosMudaram();
    });
  };

  return { registrarDeposito, copiarCobranca };
}
