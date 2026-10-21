import { invoke, isTauri } from '@tauri-apps/api/core';

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
  inspecionar(origem: string, senha?: string): Promise<InfoDoBackup>;
  restaurar(origem: string, nome: string, senha?: string): Promise<void>;
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
    inspecionar: (origem, senha) => invoke('inspecionar_backup', { origem, senha: senha ?? null }),
    restaurar: (origem, nome, senha) =>
      invoke('restaurar_backup', { origem, nome, senha: senha ?? null }),
  };
}

export async function salvarPlanilha(nome: string, bytes: Uint8Array): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const destino = await save({
      defaultPath: nome,
      filters: [{ name: 'Planilha do Excel', extensions: ['xlsx'] }],
    });
    if (!destino) return null;
    await invoke('salvar_planilha', { destino, bytes: Array.from(bytes) });
    return destino;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([bytes as BlobPart]));
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
  return nome;
}
