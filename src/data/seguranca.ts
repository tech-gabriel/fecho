import { invoke } from '@tauri-apps/api/core';

export interface EstadoDaSeguranca {
  pinAtivo: boolean;
  backupCriptografado: boolean;
  arquivo: string;
}

export interface ServicoDeSeguranca {
  criptografiaDeBackupDisponivel: boolean;
  estado(): Promise<EstadoDaSeguranca>;
  definirPin(pin: string): Promise<void>;
  conferirPin(pin: string): Promise<boolean>;
  removerPin(pinAtual: string): Promise<boolean>;
  definirSenhaDeBackup(senha: string | null): Promise<void>;
}

export function segurancaDoTauri(): ServicoDeSeguranca {
  return {
    criptografiaDeBackupDisponivel: true,
    estado: () => invoke('estado_da_seguranca'),
    definirPin: (pin) => invoke('definir_pin', { pin }),
    conferirPin: (pin) => invoke('conferir_pin', { pin }),
    removerPin: (pin) => invoke('remover_pin', { pin }),
    definirSenhaDeBackup: (senha) => invoke('definir_senha_de_backup', { senha }),
  };
}

const CHAVE = 'fecho:pin';
const ITERACOES = 200_000;

const emHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

async function derivar(pin: string, sal: string): Promise<string> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sal), iterations: ITERACOES },
    base,
    256,
  );
  return emHex(bits);
}

function lerGuardado(): { sal: string; hash: string } | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as { sal: string; hash: string }) : null;
  } catch {
    return null;
  }
}

export function segurancaDoNavegador(): ServicoDeSeguranca {
  const confere = async (pin: string) => {
    const guardado = lerGuardado();
    return guardado !== null && (await derivar(pin, guardado.sal)) === guardado.hash;
  };
  return {
    criptografiaDeBackupDisponivel: false,
    estado: () =>
      Promise.resolve({
        pinAtivo: lerGuardado() !== null,
        backupCriptografado: false,
        arquivo: '',
      }),
    definirPin: async (pin) => {
      const sal = emHex(crypto.getRandomValues(new Uint8Array(16)));
      localStorage.setItem(CHAVE, JSON.stringify({ sal, hash: await derivar(pin, sal) }));
    },
    conferirPin: confere,
    removerPin: async (pin) => {
      if (!(await confere(pin))) return false;
      localStorage.removeItem(CHAVE);
      return true;
    },
    definirSenhaDeBackup: () =>
      Promise.reject(new Error('A criptografia de backup só funciona no app instalado')),
  };
}
