import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { legendaDoMes, type Competencia } from '@/domain/competencia';
import { mesAbreviado, nomeDoMes } from '@/lib/formato';
import { hojeLocal, useApp } from '../store';
import { Dica } from './apoio';

function Legenda({ competencia }: { competencia: Competencia }) {
  const legenda = legendaDoMes(competencia, hojeLocal());
  if (legenda.tipo === 'futuro') return <>Previsto</>;
  if (legenda.tipo === 'passado') {
    return (
      <>
        <Clock size={12} strokeWidth={1.75} aria-hidden />
        Em aberto
      </>
    );
  }
  const dias = legenda.diasParaFechar;
  if (dias === 0) return <>Fecha hoje</>;
  if (dias === 1) return <>Fecha amanhã</>;
  return <>Fecha em {dias} dias</>;
}

export function SeletorMes() {
  const { competencia, voltarMes, avancarMes } = useApp();

  return (
    <div
      role="group"
      aria-label="Mês de referência"
      className="flex flex-col rounded-lg border p-1"
    >
      <div className="flex items-center justify-between">
        <Dica texto="Mês anterior (Ctrl+←)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mês anterior"
            aria-keyshortcuts="Control+ArrowLeft"
            onClick={voltarMes}
          >
            <ChevronLeft strokeWidth={1.75} />
          </Button>
        </Dica>
        <span aria-live="polite" className="text-sm font-semibold">
          {nomeDoMes(competencia)}
        </span>
        <Dica texto="Próximo mês (Ctrl+→)">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo mês"
            aria-keyshortcuts="Control+ArrowRight"
            onClick={avancarMes}
          >
            <ChevronRight strokeWidth={1.75} />
          </Button>
        </Dica>
      </div>
      <p className="flex items-center justify-center gap-1 pb-2 text-xs text-ink-muted">
        <Legenda competencia={competencia} />
      </p>
    </div>
  );
}

export function SeletorMesRecolhido() {
  const { competencia, alternarSidebar } = useApp();
  const { mes, ano } = mesAbreviado(competencia);

  return (
    <Dica texto="Expandir (Ctrl+B)" lado="right">
      <button
        type="button"
        aria-label={`${nomeDoMes(competencia)}, expandir a barra lateral`}
        aria-keyshortcuts="Control+B"
        onClick={alternarSidebar}
        className="flex size-10 flex-col items-center justify-center self-center rounded-lg border text-xs leading-[14px] font-semibold hover:bg-soft"
      >
        {mes}
        <span className="font-normal text-ink-muted">{ano}</span>
      </button>
    </Dica>
  );
}
