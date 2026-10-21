export const MAXIMO_DE_TENTATIVAS = 5;
export const ESPERA_DEPOIS_DO_LIMITE_MS = 60_000;
export const OPCOES_DE_BLOQUEIO = [1, 5, 15, 30] as const;
export const BLOQUEIO_PADRAO = 5;

export const validarPin = (texto: string) => /^\d{4}$/.test(texto);

export const tentativasRestantes = (erros: number) => Math.max(MAXIMO_DE_TENTATIVAS - erros, 0);

export function esperaAte(erros: number, agora: number): number | null {
  return erros >= MAXIMO_DE_TENTATIVAS ? agora + ESPERA_DEPOIS_DO_LIMITE_MS : null;
}

export function validarSenhaDeBackup(senha: string, confirmacao: string): string | null {
  if (senha.length < 8) return 'Use pelo menos 8 caracteres';
  if (senha !== confirmacao) return 'As senhas não são iguais';
  return null;
}

export function minutosParaBloquear(preferencia: number | null): number | null {
  if (preferencia === null) return null;
  return (OPCOES_DE_BLOQUEIO as readonly number[]).includes(preferencia)
    ? preferencia
    : BLOQUEIO_PADRAO;
}
