import { isTauri } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

let permitido: Promise<boolean> | null = null;
const enviados = new Set<string>();

export async function notificarNoWindows(
  avisos: readonly { chave: string; texto: string }[],
): Promise<string[]> {
  const novos = avisos.filter((a) => !enviados.has(a.chave));
  if (!isTauri() || novos.length === 0) return [];
  permitido ??= isPermissionGranted().then(
    async (concedida) => concedida || (await requestPermission()) === 'granted',
  );
  if (!(await permitido)) return [];
  for (const { chave, texto } of novos) {
    if (enviados.has(chave)) continue;
    enviados.add(chave);
    sendNotification({ title: 'Fechô', body: texto });
  }
  return novos.map((a) => a.chave);
}
