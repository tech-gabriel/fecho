import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Bell,
  BellOff,
  CalendarClock,
  Copy,
  CreditCard,
  Repeat,
  TriangleAlert,
} from 'lucide-react';
import { cn } from 'cn';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PREFERENCIAS_PADRAO } from '@/data/repositories';
import { grupoDoAlerta, type GrupoDeAlerta, type TipoDeAlerta } from '@/domain/alertas';
import { useAcoesDeCobranca } from '@/features/receber/acoes';
import { quandoComecou } from './textos';
import { useAlertas, type AlertaNaTela } from './useAlertas';

const VISUAL: Record<TipoDeAlerta, { icone: typeof Bell; classe: string }> = {
  atraso: { icone: TriangleAlert, classe: 'bg-danger-bg text-danger-text' },
  reembolso: { icone: TriangleAlert, classe: 'bg-warning-bg text-warning-text' },
  vencimento: { icone: CalendarClock, classe: 'bg-warning-bg text-warning-text' },
  fechamento: { icone: CreditCard, classe: 'bg-soft text-ink' },
  assinatura: { icone: Repeat, classe: 'bg-info-bg text-info-text' },
};

const GRUPOS: GrupoDeAlerta[] = ['Hoje', 'Esta semana', 'Antes'];

export function CentralDeAlertas() {
  const { alertas, hoje, preferencias, marcarComoLidos } = useAlertas();
  const { copiarCobranca } = useAcoesDeCobranca(preferencias ?? PREFERENCIAS_PADRAO, hoje);
  const irParaCompetencia = useApp((s) => s.irParaCompetencia);
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(false);
  const naoLidos = alertas.filter((a) => !a.lido).length;

  const abrir = (alerta: AlertaNaTela) => {
    marcarComoLidos([alerta.chave]);
    setAberta(false);
    if (alerta.tipo === 'assinatura') {
      void navigate('/assinaturas');
      return;
    }
    irParaCompetencia(alerta.competencia);
    void navigate(
      alerta.tipo === 'reembolso' && alerta.terceiro
        ? `/receber?pessoa=${String(alerta.terceiro.id)}`
        : `/faturas?cartao=${String(alerta.cartao.id)}`,
    );
  };

  const cobrar = (alerta: AlertaNaTela) => {
    if (!alerta.terceiro) return;
    void copiarCobranca(
      alerta.terceiro,
      { valor: alerta.valor ?? 0, cartao: alerta.cartao.nome, vencimento: alerta.data },
      () => {
        marcarComoLidos([alerta.chave]);
      },
    );
  };

  return (
    <Popover open={aberta} onOpenChange={setAberta}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={
            naoLidos === 0
              ? 'Alertas'
              : `Alertas, ${String(naoLidos)} ${naoLidos === 1 ? 'novo' : 'novos'}`
          }
        >
          <Bell strokeWidth={1.75} />
          {naoLidos > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-surface"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[600px] w-[400px] flex-col overflow-hidden rounded-[10px] p-0"
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Alertas</h2>
          {naoLidos > 0 && (
            <span className="rounded-full bg-brand-subtle px-2 text-xs leading-4 font-semibold text-brand-text">
              {naoLidos} {naoLidos === 1 ? 'nova' : 'novas'}
            </span>
          )}
          <span className="flex-1" />
          {naoLidos > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-text"
              onClick={() => {
                marcarComoLidos(alertas.map((a) => a.chave));
              }}
            >
              Marcar tudo como lido
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-ink-muted">
              <span className="flex size-12 items-center justify-center rounded-full bg-soft">
                <BellOff size={24} strokeWidth={1.75} aria-hidden />
              </span>
              Nenhum alerta por enquanto.
            </div>
          ) : (
            GRUPOS.map((grupo) => {
              const doGrupo = alertas.filter((a) => grupoDoAlerta(a.idade) === grupo);
              if (doGrupo.length === 0) return null;
              return (
                <section key={grupo} aria-label={grupo} className="flex flex-col">
                  <h3 className="px-4 pt-2 pb-1 text-xs font-medium text-ink-muted">{grupo}</h3>
                  <ul className="flex flex-col px-2">
                    {doGrupo.map((alerta) => (
                      <ItemDoAlerta
                        key={alerta.chave}
                        alerta={alerta}
                        onAbrir={abrir}
                        onCobrar={cobrar}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-ink-muted">
          <span>Alertas ficam 30 dias</span>
          <button
            type="button"
            className="font-medium text-brand-text hover:underline"
            onClick={() => {
              setAberta(false);
              void navigate('/configuracoes?secao=alertas');
            }}
          >
            Escolher alertas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ItemDoAlerta({
  alerta,
  onAbrir,
  onCobrar,
}: {
  alerta: AlertaNaTela;
  onAbrir: (alerta: AlertaNaTela) => void;
  onCobrar: (alerta: AlertaNaTela) => void;
}) {
  const { icone: Icone, classe } = VISUAL[alerta.tipo];
  return (
    <li className="relative flex items-start gap-3 rounded-md px-2 py-2 hover:bg-soft">
      <span className={cn('flex size-8 flex-none items-center justify-center rounded-md', classe)}>
        <Icone size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            onAbrir(alerta);
          }}
          className={cn(
            'text-left text-[13px] leading-[18px] text-pretty after:absolute after:inset-0 after:rounded-md',
            !alerta.lido && 'font-semibold',
          )}
        >
          {!alerta.lido && <span className="sr-only">Novo: </span>}
          {alerta.texto}
        </button>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>{quandoComecou(alerta.idade)}</span>
          {alerta.tipo === 'reembolso' && alerta.terceiro && (
            <Button
              variant="outline"
              size="sm"
              className="relative z-10 h-7"
              onClick={() => {
                onCobrar(alerta);
              }}
            >
              <Copy strokeWidth={1.75} />
              Cobrar
            </Button>
          )}
        </div>
      </div>
      {!alerta.lido && (
        <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-brand" />
      )}
    </li>
  );
}
