const UM_DIA = 24 * 60 * 60 * 1000;
const dois = (n: number) => String(n).padStart(2, '0');

export function backupAutomaticoPendente(ultimo: string | null, agora: Date): boolean {
  const quando = ultimo ? Date.parse(ultimo) : Number.NaN;
  return Number.isNaN(quando) || agora.getTime() - quando >= UM_DIA;
}

export function nomeDoBackup(agora: Date): string {
  const data = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
  const hora = `${dois(agora.getHours())}${dois(agora.getMinutes())}${dois(agora.getSeconds())}`;
  return `fecho-${data}-${hora}.db`;
}
