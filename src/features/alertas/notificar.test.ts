import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve('granted')),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: plugin.isTauri }));
vi.mock('@tauri-apps/plugin-notification', () => plugin);

const carregar = async () => (await import('./notificar')).notificarNoWindows;
const aviso = (chave: string) => ({ chave, texto: `Texto de ${chave}` });

beforeEach(() => {
  vi.resetModules();
  plugin.isTauri.mockReturnValue(true);
  plugin.isPermissionGranted.mockResolvedValue(true);
  plugin.requestPermission.mockResolvedValue('granted');
  plugin.sendNotification.mockClear();
  plugin.requestPermission.mockClear();
});

describe('notificarNoWindows', () => {
  it('envia cada alerta uma vez só', async () => {
    const notificar = await carregar();

    expect(await notificar([aviso('a'), aviso('b')])).toEqual(['a', 'b']);
    expect(await notificar([aviso('a'), aviso('c')])).toEqual(['c']);

    expect(plugin.sendNotification).toHaveBeenCalledTimes(3);
    expect(plugin.sendNotification).toHaveBeenCalledWith({ title: 'Fechô', body: 'Texto de a' });
  });

  it('não faz nada fora do app instalado', async () => {
    plugin.isTauri.mockReturnValue(false);
    const notificar = await carregar();

    expect(await notificar([aviso('a')])).toEqual([]);
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('pede permissão uma vez e respeita a recusa', async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue('denied');
    const notificar = await carregar();

    expect(await notificar([aviso('a')])).toEqual([]);
    expect(await notificar([aviso('b')])).toEqual([]);

    expect(plugin.requestPermission).toHaveBeenCalledTimes(1);
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });
});
