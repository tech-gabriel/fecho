import { Plus } from 'lucide-react';
import { LogoSimbolo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-2">
        <LogoSimbolo size={40} className="text-brand" />
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.025em]">Fechô</h1>
      </div>
      <p className="text-sm text-ink-muted">
        Finanças pessoais em dia: o que é seu, o que é dos outros, e o mês fechado.
      </p>
      <div className="flex gap-3">
        <Button>
          <Plus strokeWidth={1.75} />
          Nova compra
        </Button>
        <Button variant="outline">Importar .xlsx</Button>
      </div>
    </main>
  );
}
