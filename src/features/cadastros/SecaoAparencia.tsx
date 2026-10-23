import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { escolherTema, lerTema, type Tema } from '@/lib/tema';

const OPCOES = [
  { valor: 'sistema', rotulo: 'Igual ao Windows', icone: Monitor },
  { valor: 'claro', rotulo: 'Claro', icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
] as const;

export function SecaoAparencia() {
  const [tema, setTema] = useState<Tema>(lerTema);
  return (
    <section
      id="aparencia"
      aria-labelledby="aparencia-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="aparencia-titulo" className="text-base font-semibold">
        Aparência
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-ink-muted">Tema</p>
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Tema"
          value={tema}
          onValueChange={(valor) => {
            if (!valor) return;
            setTema(valor as Tema);
            escolherTema(valor as Tema);
          }}
        >
          {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
            <ToggleGroupItem
              key={valor}
              value={valor}
              className="px-3 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
            >
              <Icone strokeWidth={1.75} aria-hidden />
              {rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </section>
  );
}
