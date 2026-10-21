import { toast } from 'sonner';

export const emCampoDeTexto = (alvo: EventTarget | null) =>
  alvo instanceof Element && alvo.closest('input, textarea, select, [contenteditable]') !== null;

export function acionar(nome: string): boolean {
  const seletor = `[data-atalho="${nome}"]:not(:disabled)`;
  const comFoco = document.activeElement?.closest('section, li, [role="tabpanel"]');
  const botao =
    comFoco?.querySelector<HTMLElement>(seletor) ?? document.querySelector<HTMLElement>(seletor);
  botao?.click();
  return botao !== null;
}

export function desfazerUltimo(): boolean {
  const comDesfazer = toast
    .getToasts()
    .filter((t) => 'action' in t && typeof t.action === 'object' && t.action !== null)
    .map((t) => ({ id: t.id, acao: (t as { action: unknown }).action }))
    .filter(
      (t): t is { id: string | number; acao: { label: string; onClick: (e: never) => void } } =>
        typeof t.acao === 'object' &&
        t.acao !== null &&
        'label' in t.acao &&
        t.acao.label === 'Desfazer' &&
        'onClick' in t.acao,
    )
    .at(-1);
  if (!comDesfazer) return false;
  comDesfazer.acao.onClick(undefined as never);
  toast.dismiss(comDesfazer.id);
  return true;
}
