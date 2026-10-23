import { isTauri } from '@tauri-apps/api/core';

export interface Atualizacao {
  versao: string;
  instalar: () => Promise<void>;
}

export const atualizacaoDisponivel = isTauri;

export async function procurarAtualizacao(): Promise<Atualizacao | null> {
  if (!isTauri()) return null;
  const [{ check }, { relaunch }] = await Promise.all([
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/plugin-process'),
  ]);
  const encontrada = await check();
  if (!encontrada) return null;
  return {
    versao: encontrada.version,
    instalar: async () => {
      await encontrada.downloadAndInstall();
      await relaunch();
    },
  };
}
