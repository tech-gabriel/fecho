import { useEffect, useId, useState } from 'react';
import { ArchiveRestore, Download, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { InfoDoBackup } from '@/data/backup';
import type { Preferencias } from '@/data';
import { nomeDoBackup } from '@/domain/backup';
import { quandoFoi } from '@/lib/formato';
import { executar } from './SecaoCadastro';

function falhou(mensagem: string, tentar: () => void) {
  return (erro: unknown) => {
    toast.error(
      erro instanceof Error && erro.message.startsWith('Este ') ? erro.message : mensagem,
      {
        action: { label: 'Tentar de novo', onClick: tentar },
      },
    );
  };
}

export function SecaoBackup() {
  const id = useId();
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const { backup } = repos;
  const [caminhos, setCaminhos] = useState<{ banco: string; backups: string } | null>(null);
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [aRestaurar, setARestaurar] = useState<{ origem: string; info: InfoDoBackup } | null>(null);

  useEffect(() => {
    if (!backup.disponivel) return;
    let montado = true;
    void Promise.all([backup.caminhos(), repos.preferencias.ler()]).then(([c, p]) => {
      if (!montado) return;
      setCaminhos(c);
      setPreferencias(p);
    });
    return () => {
      montado = false;
    };
  }, [backup, repos, versao]);

  const exportar = () => {
    backup
      .exportar(nomeDoBackup(new Date()))
      .then((destino) => {
        if (destino) toast.success(`Backup salvo em ${destino}`);
      })
      .catch(falhou('Não foi possível salvar o backup.', exportar));
  };

  const escolher = () => {
    backup
      .escolherBackup()
      .then(async (origem) => {
        if (!origem) return;
        setARestaurar({ origem, info: await backup.inspecionar(origem) });
      })
      .catch(falhou('Não foi possível ler esse arquivo.', escolher));
  };

  const restaurar = (origem: string) => {
    setARestaurar(null);
    backup.restaurar(origem, nomeDoBackup(new Date())).catch(
      falhou('Não foi possível restaurar o backup.', () => {
        restaurar(origem);
      }),
    );
  };

  const alternarAutomatico = (ligado: boolean) =>
    executar(async () => {
      await repos.preferencias.gravar({ backupAutomatico: ligado });
      dadosMudaram();
      toast.success(ligado ? 'Backup automático ligado' : 'Backup automático desligado');
    });

  const compras = aRestaurar?.info.compras ?? 0;

  return (
    <section
      id="dados"
      aria-labelledby="dados-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="dados-titulo" className="text-base font-semibold">
        Dados e backup
      </h2>

      {!backup.disponivel ? (
        <p className="text-sm text-ink-muted">Backup e restauração funcionam no app instalado.</p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <HardDrive size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 text-ink-muted" />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">Seus dados ficam neste computador</span>
              <span className="truncate text-[13px] text-ink-muted" title={caminhos?.banco}>
                {caminhos?.banco}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t pt-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <Label htmlFor={`${id}-automatico`} className="text-sm">
                Backup automático
              </Label>
              <span className="text-[13px] text-ink-muted">
                Uma cópia por dia em {caminhos?.backups}, guardando as 10 mais recentes
              </span>
              <span className="text-[13px] text-ink-muted">
                {preferencias?.ultimoBackup
                  ? `Último backup: ${quandoFoi(new Date(preferencias.ultimoBackup), new Date())}`
                  : 'Nenhum backup ainda'}
              </span>
            </div>
            {preferencias && (
              <Switch
                id={`${id}-automatico`}
                checked={preferencias.backupAutomatico}
                onCheckedChange={(ligado) => void alternarAutomatico(ligado)}
              />
            )}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button variant="outline" onClick={exportar}>
              <Download strokeWidth={1.75} />
              Exportar backup…
            </Button>
            <Button variant="outline" onClick={escolher}>
              <ArchiveRestore strokeWidth={1.75} />
              Restaurar backup…
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={aRestaurar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setARestaurar(null);
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Restaurar o backup de{' '}
              {aRestaurar && quandoFoi(new Date(aRestaurar.info.modificadoEm), new Date())}?
            </DialogTitle>
            <DialogDescription>
              Ele tem {compras} {compras === 1 ? 'compra' : 'compras'}. Seus dados atuais ficam
              guardados em Backups antes da troca, e o Fechô reinicia.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setARestaurar(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (aRestaurar) restaurar(aRestaurar.origem);
              }}
            >
              Restaurar e reiniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
