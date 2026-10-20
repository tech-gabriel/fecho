import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export const idDoErro = (id: string) => `${id}-erro`;

export function Campo({
  id,
  rotulo,
  erro,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string | undefined;
  dica?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erro ? (
        <p id={idDoErro(id)} className="text-xs text-danger-text">
          {erro}
        </p>
      ) : (
        dica && <p className="text-xs text-ink-muted">{dica}</p>
      )}
    </div>
  );
}

export const atributosDeErro = (id: string, erro: string | undefined) => ({
  id,
  'aria-invalid': erro ? true : undefined,
  'aria-describedby': erro ? idDoErro(id) : undefined,
});
