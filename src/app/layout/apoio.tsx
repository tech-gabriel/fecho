import type { ReactElement, ReactNode } from 'react';
import { cn } from 'cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function Dica({
  texto,
  lado = 'bottom',
  children,
}: {
  texto: string;
  lado?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={lado} sideOffset={4}>
        {texto}
      </TooltipContent>
    </Tooltip>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded-md px-2 py-0.5 font-sans text-xs font-medium text-ink-muted-on-tint',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
