import { invoke, isTauri } from '@tauri-apps/api/core';
import { backupDoTauri } from './backup';
import { segurancaDoTauri } from './seguranca';
import { criarRepositoriosEmMemoria } from './memory';
import { semearDadosFicticios } from './memory/dados-ficticios';
import type { Repositorios } from './repositories';

export type * from './repositories';

export async function criarRepositorios(): Promise<Repositorios> {
  if (!isTauri()) {
    const repos = criarRepositoriosEmMemoria();
    await semearDadosFicticios(repos);
    return repos;
  }

  const [{ default: Database }, { criarRepositoriosSqlite }] = await Promise.all([
    import('@tauri-apps/plugin-sql'),
    import('./sqlite'),
  ]);
  const banco = await Database.load('sqlite:fecho.db');
  return criarRepositoriosSqlite(
    banco,
    {
      salvarCompra: (preparada) => invoke<number>('salvar_compra', { ...preparada }),
      importarCompras: (compras) => invoke<number[]>('importar_compras', { compras }),
      registrarDeposito: (deposito) => invoke<number>('registrar_deposito', { deposito }),
      substituirCompra: (id, preparada) =>
        invoke<undefined>('substituir_compra', { id, ...preparada }),
      atualizarCartao: (id, cartao, parcelas) =>
        invoke<undefined>('atualizar_cartao', { id, cartao, parcelas }),
    },
    backupDoTauri(),
    segurancaDoTauri(),
  );
}
