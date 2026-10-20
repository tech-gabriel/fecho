import { invoke } from '@tauri-apps/api/core';

export interface InfoDoBackup {
  compras: number;
  versao: number;
  modificadoEm: number;
}

export interface ServicoDeBackup {
  disponivel: boolean;
  caminhos(): Promise<{ banco: string; backups: string }>;
  exportar(nomeSugerido: string): Promise<string | null>;
  automatico(nome: string): Promise<string>;
  escolherBackup(): Promise<string | null>;
  inspecionar(origem: string): Promise<InfoDoBackup>;
  restaurar(origem: string, nome: string): Promise<void>;
}

const FILTROS = [{ name: 'Backup do Fechô', extensions: ['db'] }];
const indisponivel = () => Promise.reject(new Error('Backup só funciona no app instalado'));

export const backupIndisponivel: ServicoDeBackup = {
  disponivel: false,
  caminhos: indisponivel,
  exportar: indisponivel,
  automatico: indisponivel,
  escolherBackup: indisponivel,
  inspecionar: indisponivel,
  restaurar: indisponivel,
};

export function backupDoTauri(): ServicoDeBackup {
  const dialogo = () => import('@tauri-apps/plugin-dialog');
  return {
    disponivel: true,
    caminhos: () => invoke('caminhos_de_dados'),
    exportar: async (nomeSugerido) => {
      const destino = await (await dialogo()).save({ defaultPath: nomeSugerido, filters: FILTROS });
      if (!destino) return null;
      await invoke('exportar_backup', { destino });
      return destino;
    },
    automatico: (nome) => invoke('backup_automatico', { nome }),
    escolherBackup: async () =>
      (await dialogo()).open({ multiple: false, directory: false, filters: FILTROS }),
    inspecionar: (origem) => invoke('inspecionar_backup', { origem }),
    restaurar: (origem, nome) => invoke('restaurar_backup', { origem, nome }),
  };
}
