import { useState } from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DataLocal } from '@/domain/competencia';

const paraDate = (data: DataLocal) => parse(data, 'yyyy-MM-dd', new Date());

export function SeletorData({
  id,
  valor,
  hoje,
  onEscolher,
}: {
  id: string;
  valor: DataLocal;
  hoje: DataLocal;
  onEscolher: (data: DataLocal) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionada = paraDate(valor);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" className="w-full justify-start px-3 font-normal">
          <CalendarDays strokeWidth={1.75} className="text-ink-muted" />
          <span className="flex-1 text-left tabular-nums">{format(selecionada, 'dd/MM/yyyy')}</span>
          {valor === hoje && (
            <span className="rounded-md bg-soft px-1.5 text-xs font-medium text-ink-muted-on-tint">
              hoje
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selecionada}
          defaultMonth={selecionada}
          required
          onSelect={(data) => {
            onEscolher(format(data, 'yyyy-MM-dd'));
            setAberto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
