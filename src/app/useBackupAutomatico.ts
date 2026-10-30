import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Repositorios } from '@/data';
import { backupAutomaticoPendente, nomeDoBackup } from '@/domain/backup';
import { useRepositorios } from './repositorios';
import { useApp } from './store';

export async function copiarParaFora(repos: Repositorios, aoTerminar: () => void) {
  const { pastaDaCopiaExterna: pasta } = await repos.preferencias.ler();
  if (!repos.backup.disponivel || !pasta) return;
  const tentar = () => {
    const agora = new Date();
    repos.backup
      .automatico(nomeDoBackup(agora), pasta)
      .then(() => repos.preferencias.gravar({ ultimaCopiaExterna: agora.toISOString() }))
      .then(aoTerminar)
      .catch(() => {
        toast.error(`A cópia em ${pasta} falhou.`, {
          action: { label: 'Tentar de novo', onClick: tentar },
        });
      });
  };
  tentar();
}

export function useBackupAutomatico() {
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const jaRodou = useRef(false);

  useEffect(() => {
    if (!repos.backup.disponivel || jaRodou.current) return;
    jaRodou.current = true;

    const fazer = async () => {
      const preferencias = await repos.preferencias.ler();
      const agora = new Date();
      if (
        !preferencias.backupAutomatico ||
        !backupAutomaticoPendente(preferencias.ultimoBackup, agora)
      ) {
        return;
      }
      await repos.backup.automatico(nomeDoBackup(agora));
      await repos.preferencias.gravar({ ultimoBackup: agora.toISOString() });
      dadosMudaram();
    };
    const tentar = () => {
      fazer().catch(() => {
        toast.error('O backup automático falhou.', {
          action: { label: 'Tentar de novo', onClick: tentar },
        });
      });
    };
    tentar();

    void repos.preferencias.ler().then(({ ultimaCopiaExterna }) => {
      if (backupAutomaticoPendente(ultimaCopiaExterna, new Date(), 7)) {
        void copiarParaFora(repos, dadosMudaram);
      }
    });
  }, [repos, dadosMudaram]);
}
