import { useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import type { Cartao, Categoria, Novo, Terceiro } from '@/data';
import { lerReais } from '@/domain/money';
import { formatarDecimal } from '@/lib/formato';
import { atributosDeErro, Campo } from './Campo';
import { COR_DE_PESSOA, CORES_DE_CARTAO, ICONES_DE_CATEGORIA } from './opcoes';

export interface PropsDoFormulario<T> {
  idForm: string;
  inicial?: T;
  onEnviar: (dados: Novo<T>) => void;
}

const nome = z.string().trim().min(1, 'Digite um nome');

const dia = z
  .string()
  .trim()
  .regex(/^\d{1,2}$/, 'Use um dia de 1 a 31')
  .transform(Number)
  .refine((d) => d >= 1 && d <= 31, 'Use um dia de 1 a 31');

const reais = z.string().transform((texto, ctx) => {
  if (!texto.trim()) return 0;
  try {
    return lerReais(texto);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Digite um valor como 1.234,56' });
    return z.NEVER;
  }
});

const esquemaCartao = z.object({
  nome,
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Escolha uma cor'),
  diaFechamento: dia,
  diaVencimento: dia,
  limite: reais,
});

const classeDoGrupo = 'flex flex-col gap-2 border-0 p-0';
const classeDaLegenda = 'mb-2 text-[13px] leading-[18px] font-medium';

export function FormCartao({ idForm, inicial, onEnviar }: PropsDoFormulario<Cartao>) {
  const id = useId();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaCartao),
    defaultValues: {
      nome: inicial?.nome ?? '',
      cor: inicial?.cor ?? CORES_DE_CARTAO[0].hex,
      diaFechamento: inicial ? String(inicial.diaFechamento) : '',
      diaVencimento: inicial ? String(inicial.diaVencimento) : '',
      limite: inicial?.limiteCentavos ? formatarDecimal(inicial.limiteCentavos) : '',
    },
  });
  const cor = useWatch({ control, name: 'cor' });
  const personalizada = !CORES_DE_CARTAO.some((c) => c.hex === cor.toUpperCase());

  return (
    <form
      id={idForm}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void handleSubmit(({ limite, ...dados }) => {
          onEnviar({ ...dados, limiteCentavos: limite, ativo: inicial?.ativo ?? true });
        })(e)
      }
    >
      <Campo id={`${id}-nome`} rotulo="Nome" erro={errors.nome?.message}>
        <Input
          {...atributosDeErro(`${id}-nome`, errors.nome?.message)}
          placeholder="Cartão Roxo"
          {...register('nome')}
        />
      </Campo>

      <fieldset className={classeDoGrupo}>
        <legend className={classeDaLegenda}>Cor</legend>
        <div className="flex gap-2">
          {CORES_DE_CARTAO.map((cor) => (
            <label key={cor.hex} className="relative cursor-pointer">
              <input
                type="radio"
                value={cor.hex}
                aria-label={cor.nome}
                className="peer sr-only"
                {...register('cor')}
              />
              <span
                aria-hidden
                style={{ backgroundColor: cor.hex }}
                className="block size-7 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-(--focus-ring)"
              />
            </label>
          ))}
          <label className="relative cursor-pointer" title="Outra cor">
            <input
              type="color"
              aria-label="Outra cor"
              value={personalizada ? cor : '#FF6000'}
              onChange={(e) => {
                setValue('cor', e.target.value.toUpperCase(), { shouldDirty: true });
              }}
              className="peer sr-only"
            />
            <span
              aria-hidden
              style={{
                background: personalizada
                  ? cor
                  : 'conic-gradient(#EF4444, #F59E0B, #84CC16, #06B6D4, #6366F1, #EC4899, #EF4444)',
              }}
              className={cn(
                'block size-7 rounded-full ring-offset-2 ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-(--focus-ring)',
                personalizada && 'ring-2 ring-ink',
              )}
            />
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-fecha`} rotulo="Fecha dia" erro={errors.diaFechamento?.message}>
          <Input
            {...atributosDeErro(`${id}-fecha`, errors.diaFechamento?.message)}
            inputMode="numeric"
            placeholder="28"
            {...register('diaFechamento')}
          />
        </Campo>
        <Campo id={`${id}-vence`} rotulo="Vence dia" erro={errors.diaVencimento?.message}>
          <Input
            {...atributosDeErro(`${id}-vence`, errors.diaVencimento?.message)}
            inputMode="numeric"
            placeholder="5"
            {...register('diaVencimento')}
          />
        </Campo>
      </div>

      <Campo
        id={`${id}-limite`}
        rotulo="Limite"
        erro={errors.limite?.message}
        dica="Opcional. Serve para mostrar quanto do limite você já usou."
      >
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted"
          >
            R$
          </span>
          <Input
            {...atributosDeErro(`${id}-limite`, errors.limite?.message)}
            inputMode="decimal"
            placeholder="5.000,00"
            className="pl-9 tabular-nums"
            {...register('limite')}
          />
        </div>
      </Campo>
    </form>
  );
}

const esquemaPessoa = z.object({ nome });

export function FormPessoa({ idForm, inicial, onEnviar }: PropsDoFormulario<Terceiro>) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaPessoa),
    defaultValues: { nome: inicial?.nome ?? '' },
  });

  return (
    <form
      id={idForm}
      noValidate
      onSubmit={(e) =>
        void handleSubmit((dados) => {
          onEnviar({
            ...dados,
            cor: inicial?.cor ?? COR_DE_PESSOA,
            ativo: inicial?.ativo ?? true,
          });
        })(e)
      }
    >
      <Campo
        id={`${id}-nome`}
        rotulo="Nome"
        erro={errors.nome?.message}
        dica="Quem usa o seu cartão e depois deposita o valor."
      >
        <Input
          {...atributosDeErro(`${id}-nome`, errors.nome?.message)}
          placeholder="Ana"
          {...register('nome')}
        />
      </Campo>
    </form>
  );
}

const esquemaCategoria = z.object({ nome, icone: z.string() });

export function FormCategoria({ idForm, inicial, onEnviar }: PropsDoFormulario<Categoria>) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaCategoria),
    defaultValues: { nome: inicial?.nome ?? '', icone: inicial?.icone ?? 'tag' },
  });

  return (
    <form
      id={idForm}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void handleSubmit((dados) => {
          onEnviar({ ...dados, ativo: inicial?.ativo ?? true });
        })(e)
      }
    >
      <Campo id={`${id}-nome`} rotulo="Nome" erro={errors.nome?.message}>
        <Input
          {...atributosDeErro(`${id}-nome`, errors.nome?.message)}
          placeholder="Mercado"
          {...register('nome')}
        />
      </Campo>

      <fieldset className={classeDoGrupo}>
        <legend className={classeDaLegenda}>Ícone</legend>
        <div className="grid grid-cols-8 gap-2">
          {Object.entries(ICONES_DE_CATEGORIA).map(([valor, { rotulo, icone: Icone }]) => (
            <label key={valor} className="relative cursor-pointer">
              <input
                type="radio"
                value={valor}
                aria-label={rotulo}
                className="peer sr-only"
                {...register('icone')}
              />
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-md border text-ink-muted peer-checked:border-brand peer-checked:bg-brand-subtle peer-checked:text-brand-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus-ring)"
              >
                <Icone size={16} strokeWidth={1.75} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
