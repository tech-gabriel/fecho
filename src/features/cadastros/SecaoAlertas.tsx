import { useEffect, useId, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Preferencias } from '@/data';
import type { TipoDeAlerta } from '@/domain/alertas';
import { executar } from './SecaoCadastro';

const TIPOS: { tipo: TipoDeAlerta; rotulo: string; dica: string }[] = [
  {
    tipo: 'reembolso',
    rotulo: 'Reembolso pendente',
    dica: 'A partir de 5 dias antes do vencimento, quando alguém ainda deve parte da fatura',
  },
  {
    tipo: 'fechamento',
    rotulo: 'Cartão fecha em breve',
    dica: 'Nos 3 dias antes do fechamento de cada cartão',
  },
  { tipo: 'vencimento', rotulo: 'Fatura vence', dica: 'Nos 3 dias antes do vencimento' },
  { tipo: 'atraso', rotulo: 'Fatura atrasada', dica: 'Até 30 dias depois do vencimento' },
  { tipo: 'assinatura', rotulo: 'Cobrança de assinatura', dica: 'Na véspera de cada cobrança' },
  {
    tipo: 'parcela-emprestimo',
    rotulo: 'Parcela de empréstimo',
    dica: 'No dia do débito, até você marcar como paga',
  },
  {
    tipo: 'devolucao',
    rotulo: 'Empréstimo não devolvido',
    dica: 'Quando alguém passa da data combinada para devolver',
  },
];

type DeAlertas = Pick<Preferencias, 'alertasDesligados' | 'notificarNoWindows'>;

export function SecaoAlertas() {
  const id = useId();
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [atual, setAtual] = useState<DeAlertas | null>(null);
  const noApp = isTauri();

  useEffect(() => {
    let montado = true;
    void repos.preferencias.ler().then(({ alertasDesligados, notificarNoWindows }) => {
      if (montado) setAtual({ alertasDesligados, notificarNoWindows });
    });
    return () => {
      montado = false;
    };
  }, [repos]);

  const gravar = (mudanca: Partial<DeAlertas>) => {
    if (!atual) return;
    void executar(async () => {
      await repos.preferencias.gravar(mudanca);
      setAtual({ ...atual, ...mudanca });
      dadosMudaram();
      toast.success('Alertas atualizados');
    });
  };

  const linha = 'flex items-center gap-4 border-t pt-4 first-of-type:border-t-0 first-of-type:pt-0';

  return (
    <section
      id="alertas"
      aria-labelledby="alertas-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="alertas-titulo" className="text-base font-semibold">
        Alertas
      </h2>
      {atual && (
        <>
          {TIPOS.map(({ tipo, rotulo, dica }) => (
            <div key={tipo} className={linha}>
              <div className="flex min-w-0 flex-1 flex-col">
                <Label htmlFor={`${id}-${tipo}`} className="text-sm">
                  {rotulo}
                </Label>
                <span className="text-[13px] text-ink-muted">{dica}</span>
              </div>
              <Switch
                id={`${id}-${tipo}`}
                checked={!atual.alertasDesligados.includes(tipo)}
                onCheckedChange={(ligado) => {
                  gravar({
                    alertasDesligados: ligado
                      ? atual.alertasDesligados.filter((t) => t !== tipo)
                      : [...atual.alertasDesligados, tipo],
                  });
                }}
              />
            </div>
          ))}
          <div className={linha}>
            <div className="flex min-w-0 flex-1 flex-col">
              <Label htmlFor={`${id}-windows`} className="text-sm">
                Avisar também pelo Windows
              </Label>
              <span className="text-[13px] text-ink-muted">
                {noApp
                  ? 'Cada alerta novo vira uma notificação, uma vez só, enquanto o Fechô está aberto'
                  : 'Só no app instalado'}
              </span>
            </div>
            <Switch
              id={`${id}-windows`}
              disabled={!noApp}
              checked={noApp && atual.notificarNoWindows}
              onCheckedChange={(ligado) => {
                gravar({ notificarNoWindows: ligado });
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
