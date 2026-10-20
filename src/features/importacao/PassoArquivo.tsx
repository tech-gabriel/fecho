import { useEffect, useRef } from 'react';
import { CircleCheck, FileSpreadsheet, Upload } from 'lucide-react';
import { cn } from 'cn';
import { Kbd } from '@/app/layout/apoio';
import { Button } from '@/components/ui/button';
import type { PlanilhaLida } from './lerPlanilha';

const tamanhoLegivel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

export function PassoArquivo({
  planilha,
  erro,
  lendo,
  onArquivo,
  onTrocar,
}: {
  planilha: PlanilhaLida | null;
  erro: string | null;
  lendo: boolean;
  onArquivo: (arquivo: File) => void;
  onTrocar: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        campo.current?.click();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  const seletor = (
    <input
      ref={campo}
      type="file"
      accept=".xlsx,.csv"
      aria-label="Arquivo da planilha"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) onArquivo(arquivo);
        e.target.value = '';
      }}
    />
  );

  if (planilha) {
    const linhas = planilha.abas.reduce((soma, aba) => soma + aba.linhas.length, 0);
    return (
      <div className="flex flex-col gap-4">
        {seletor}
        <div className="flex items-center gap-4 rounded-lg border p-4">
          <FileSpreadsheet size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{planilha.nome}</span>
            <span className="text-[13px] text-ink-muted">
              {tamanhoLegivel(planilha.tamanho)} · {planilha.abas.length}{' '}
              {planilha.abas.length === 1 ? 'aba' : 'abas'} · {linhas} linhas
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-success-bg px-2 text-xs font-semibold text-success-text">
            <CircleCheck size={12} strokeWidth={1.75} aria-hidden className="text-success" />
            Arquivo lido
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onTrocar();
              campo.current?.click();
            }}
          >
            Trocar
          </Button>
        </div>
        <p className="rounded-md bg-info-bg px-4 py-3 text-[13px] text-info-text">
          {planilha.abas.length === 1
            ? 'Encontramos 1 aba.'
            : `Encontramos ${planilha.abas.length} abas: ${planilha.abas.map((a) => a.nome).join(', ')}.`}{' '}
          No próximo passo você confere cada uma.
        </p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const arquivo = e.dataTransfer.files[0];
        if (arquivo) onArquivo(arquivo);
      }}
      className={cn(
        'flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-12 text-center hover:bg-brand-subtle',
        erro ? 'border-danger' : 'border-border-strong',
      )}
    >
      {seletor}
      <span className="flex size-14 items-center justify-center rounded-full bg-soft">
        <Upload size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold">Arraste sua planilha para cá</span>
        <span className="text-[13px] text-ink-muted">Aceita .xlsx e .csv de até 20 MB</span>
      </div>
      <Button
        disabled={lendo}
        aria-keyshortcuts="Control+O"
        onClick={() => campo.current?.click()}
        className="pr-2"
      >
        {lendo ? 'Lendo…' : 'Escolher arquivo'}
        <Kbd className="bg-on-brand/12 text-on-brand">Ctrl O</Kbd>
      </Button>
      {erro && (
        <p role="alert" className="text-[13px] text-danger-text">
          {erro}
        </p>
      )}
    </div>
  );
}
