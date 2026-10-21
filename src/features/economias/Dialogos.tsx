import { useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { hojeLocal } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { MetaDeEconomia, MovimentoDeEconomia, Novo, Objetivo } from '@/data';
import type { Competencia } from '@/domain/competencia';
import { lerReais } from '@/domain/money';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { SeletorData } from '@/features/nova-compra/SeletorData';
import { formatarDecimal } from '@/lib/formato';

function emCentavos(texto: string): number | null {
  try {
    const centavos = lerReais(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

const valor = z.string().refine((t) => emCentavos(t) !== null, 'Digite um valor maior que zero');
const mes = z.string().regex(/^\d{4}-\d{2}$/, 'Escolha o mês');

function Rodape({ onCancelar }: { onCancelar: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancelar}>
        Cancelar
      </Button>
      <Button type="submit" className="font-semibold">
        Salvar
      </Button>
    </div>
  );
}

function Janela({
  aberta,
  titulo,
  descricao,
  onFechar,
  children,
}: {
  aberta: boolean;
  titulo: string;
  descricao: string;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={aberta}
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {aberta && children}
      </DialogContent>
    </Dialog>
  );
}

const esquemaRegistro = z
  .object({ tipo: z.enum(['guardei', 'tirei']), valor, data: z.string(), objetivoId: z.number() })
  .transform(({ tipo, valor: v, objetivoId, data }) => ({
    data,
    valorCentavos: (emCentavos(v) ?? 0) * (tipo === 'tirei' ? -1 : 1),
    objetivoId: objetivoId === 0 ? null : objetivoId,
  }));

export function DialogRegistrar({
  aberta,
  objetivos,
  onFechar,
  onSalvar,
}: {
  aberta: boolean;
  objetivos: Objetivo[];
  onFechar: () => void;
  onSalvar: (registro: Novo<MovimentoDeEconomia>) => Promise<void>;
}) {
  return (
    <Janela
      aberta={aberta}
      titulo="Registrar economia"
      descricao="Quanto você guardou ou tirou da reserva."
      onFechar={onFechar}
    >
      <FormularioRegistro objetivos={objetivos} onCancelar={onFechar} onSalvar={onSalvar} />
    </Janela>
  );
}

function FormularioRegistro({
  objetivos,
  onCancelar,
  onSalvar,
}: {
  objetivos: Objetivo[];
  onCancelar: () => void;
  onSalvar: (registro: Novo<MovimentoDeEconomia>) => Promise<void>;
}) {
  const id = useId();
  const hoje = hojeLocal();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { tipo: 'guardei' as const, valor: '', data: hoje, objetivoId: 0 },
  });
  const [tipo, data] = useWatch({ control, name: ['tipo', 'data'] });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((registro) => executar(() => onSalvar(registro)))();
      }}
      className="flex flex-col gap-4"
    >
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Guardei ou tirei"
        value={tipo}
        onValueChange={(v) => {
          if (v) setValue('tipo', v as 'guardei' | 'tirei');
        }}
        className="w-full"
      >
        {(
          [
            ['guardei', 'Guardei'],
            ['tirei', 'Tirei'],
          ] as const
        ).map(([v, rotulo]) => (
          <ToggleGroupItem
            key={v}
            value={v}
            className="flex-1 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
          >
            {rotulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-valor`} rotulo="Valor" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valor')}
          />
        </Campo>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-data`}>Data</Label>
          <SeletorData
            id={`${id}-data`}
            valor={data}
            hoje={hoje}
            onEscolher={(escolhida) => {
              setValue('data', escolhida);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-objetivo`}>Objetivo</Label>
        <Controller
          control={control}
          name="objetivoId"
          render={({ field }) => (
            <Select
              value={String(field.value)}
              onValueChange={(v) => {
                field.onChange(Number(v));
              }}
            >
              <SelectTrigger id={`${id}-objetivo`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Nenhum</SelectItem>
                {objetivos.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <Rodape onCancelar={onCancelar} />
    </form>
  );
}

const esquemaMeta = z
  .object({ valor, inicio: mes })
  .transform(({ valor: v, inicio }) => ({ valorCentavos: emCentavos(v) ?? 0, inicio }));

export function DialogMeta({
  aberta,
  atual,
  competencia,
  onFechar,
  onSalvar,
}: {
  aberta: boolean;
  atual: number | null;
  competencia: Competencia;
  onFechar: () => void;
  onSalvar: (meta: MetaDeEconomia) => Promise<void>;
}) {
  return (
    <Janela
      aberta={aberta}
      titulo={atual === null ? 'Definir meta' : 'Mudar meta'}
      descricao="Vale do mês escolhido em diante; os meses anteriores não mudam."
      onFechar={onFechar}
    >
      <FormularioMeta
        atual={atual}
        competencia={competencia}
        onCancelar={onFechar}
        onSalvar={onSalvar}
      />
    </Janela>
  );
}

function FormularioMeta({
  atual,
  competencia,
  onCancelar,
  onSalvar,
}: {
  atual: number | null;
  competencia: Competencia;
  onCancelar: () => void;
  onSalvar: (meta: MetaDeEconomia) => Promise<void>;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaMeta),
    defaultValues: { valor: atual === null ? '' : formatarDecimal(atual), inicio: competencia },
  });
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((meta) => executar(() => onSalvar(meta)))();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-valor`} rotulo="Guardar por mês" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valor')}
          />
        </Campo>
        <Campo id={`${id}-inicio`} rotulo="A partir de" erro={errors.inicio?.message}>
          <Input
            {...atributosDeErro(`${id}-inicio`, errors.inicio?.message)}
            type="month"
            {...register('inicio')}
          />
        </Campo>
      </div>
      <Rodape onCancelar={onCancelar} />
    </form>
  );
}

const esquemaObjetivo = z
  .object({
    nome: z.string().trim().min(1, 'Digite um nome'),
    valor,
    prazo: z.string().regex(/^(\d{4}-\d{2})?$/, 'Escolha o mês'),
  })
  .transform(({ nome, valor: v, prazo }) => ({
    nome,
    alvoCentavos: emCentavos(v) ?? 0,
    prazo: prazo === '' ? null : prazo,
  }));

export function DialogObjetivo({
  aberta,
  inicial,
  onFechar,
  onSalvar,
}: {
  aberta: boolean;
  inicial: Objetivo | null;
  onFechar: () => void;
  onSalvar: (objetivo: Novo<Objetivo>) => Promise<void>;
}) {
  return (
    <Janela
      aberta={aberta}
      titulo={inicial ? 'Editar objetivo' : 'Novo objetivo'}
      descricao="O que você guardar para ele aparece na barra."
      onFechar={onFechar}
    >
      <FormularioObjetivo inicial={inicial} onCancelar={onFechar} onSalvar={onSalvar} />
    </Janela>
  );
}

function FormularioObjetivo({
  inicial,
  onCancelar,
  onSalvar,
}: {
  inicial: Objetivo | null;
  onCancelar: () => void;
  onSalvar: (objetivo: Novo<Objetivo>) => Promise<void>;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaObjetivo),
    defaultValues: {
      nome: inicial?.nome ?? '',
      valor: inicial ? formatarDecimal(inicial.alvoCentavos) : '',
      prazo: inicial?.prazo ?? '',
    },
  });
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((objetivo) => executar(() => onSalvar(objetivo)))();
      }}
      className="flex flex-col gap-4"
    >
      <Campo id={`${id}-nome`} rotulo="Nome" erro={errors.nome?.message}>
        <Input
          {...atributosDeErro(`${id}-nome`, errors.nome?.message)}
          placeholder="Ex.: Viagem"
          autoComplete="off"
          {...register('nome')}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-valor`} rotulo="Quanto quer juntar" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valor')}
          />
        </Campo>
        <Campo id={`${id}-prazo`} rotulo="Até quando (opcional)" erro={errors.prazo?.message}>
          <Input
            {...atributosDeErro(`${id}-prazo`, errors.prazo?.message)}
            type="month"
            {...register('prazo')}
          />
        </Campo>
      </div>
      <Rodape onCancelar={onCancelar} />
    </form>
  );
}
