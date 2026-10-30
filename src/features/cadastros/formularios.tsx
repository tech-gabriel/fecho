import { useId, type ComponentProps } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { cn } from 'cn';
import { CartaoDesenhado, NOMES_DAS_BANDEIRAS } from '@/components/CartaoDesenhado';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Bandeira, Cartao, Categoria, Novo, Terceiro } from '@/data';
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

const SEM_BANDEIRA = 'nenhuma';

const esquemaCartao = z.object({
  nome,
  banco: z.string().trim().max(40, 'Use até 40 letras'),
  final: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}$/.test(v), 'Digite os 4 últimos números'),
  bandeira: z.string(),
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
      banco: inicial?.banco ?? '',
      final: inicial?.final ?? '',
      bandeira: inicial?.bandeira ?? SEM_BANDEIRA,
      cor: inicial?.cor ?? CORES_DE_CARTAO[0].hex,
      diaFechamento: inicial ? String(inicial.diaFechamento) : '',
      diaVencimento: inicial ? String(inicial.diaVencimento) : '',
      limite: inicial?.limiteCentavos ? formatarDecimal(inicial.limiteCentavos) : '',
    },
  });
  const [cor, nomeDigitado, banco, final, bandeira] = useWatch({
    control,
    name: ['cor', 'nome', 'banco', 'final', 'bandeira'],
  });
  const personalizada = !CORES_DE_CARTAO.some((c) => c.hex === cor.toUpperCase());

  return (
    <form
      id={idForm}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void handleSubmit(({ limite, banco, final, bandeira, ...dados }) => {
          onEnviar({
            ...dados,
            ...(banco ? { banco } : {}),
            ...(final ? { final } : {}),
            ...(bandeira === SEM_BANDEIRA ? {} : { bandeira: bandeira as Bandeira }),
            limiteCentavos: limite,
            ativo: inicial?.ativo ?? true,
          });
        })(e)
      }
    >
      <CartaoDesenhado
        tamanho="g"
        className="self-center"
        cartao={{
          nome: nomeDigitado.trim() || 'Novo cartão',
          cor,
          ...(banco.trim() ? { banco: banco.trim() } : {}),
          ...(final.trim() ? { final: final.trim() } : {}),
          ...(bandeira === SEM_BANDEIRA ? {} : { bandeira: bandeira as Bandeira }),
        }}
      />

      <Campo id={`${id}-nome`} rotulo="Nome" erro={errors.nome?.message}>
        <Input
          {...atributosDeErro(`${id}-nome`, errors.nome?.message)}
          placeholder="Cartão Roxo"
          {...register('nome')}
        />
      </Campo>

      <Campo id={`${id}-banco`} rotulo="Banco" erro={errors.banco?.message} dica="Opcional.">
        <Input
          {...atributosDeErro(`${id}-banco`, errors.banco?.message)}
          placeholder="Banco do Brasil"
          maxLength={40}
          {...register('banco')}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo
          id={`${id}-final`}
          rotulo="Final"
          erro={errors.final?.message}
          dica="Só os 4 últimos números. O Fechô nunca pede o número inteiro."
        >
          <Input
            {...atributosDeErro(`${id}-final`, errors.final?.message)}
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            className="tabular-nums"
            {...register('final')}
          />
        </Campo>
        <Campo id={`${id}-bandeira`} rotulo="Bandeira">
          <Controller
            control={control}
            name="bandeira"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${id}-bandeira`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_BANDEIRA}>Nenhuma</SelectItem>
                  {Object.entries(NOMES_DAS_BANDEIRAS).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Campo>
      </div>

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
        <EntradaEmReais
          {...atributosDeErro(`${id}-limite`, errors.limite?.message)}
          placeholder="5.000,00"
          {...register('limite')}
        />
      </Campo>
    </form>
  );
}

export function EntradaEmReais(props: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted"
      >
        R$
      </span>
      <Input inputMode="decimal" className="pl-9 tabular-nums" {...props} />
    </div>
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

const esquemaCategoria = z.object({ nome, icone: z.string(), limite: reais });

export function FormCategoria({ idForm, inicial, onEnviar }: PropsDoFormulario<Categoria>) {
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaCategoria),
    defaultValues: {
      nome: inicial?.nome ?? '',
      icone: inicial?.icone ?? 'tag',
      limite: inicial?.limiteCentavos ? formatarDecimal(inicial.limiteCentavos) : '',
    },
  });

  return (
    <form
      id={idForm}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void handleSubmit(({ limite, ...dados }) => {
          onEnviar({
            ...dados,
            ...(limite
              ? { limiteCentavos: limite }
              : inicial?.limiteCentavos
                ? { limiteCentavos: null }
                : {}),
            ativo: inicial?.ativo ?? true,
          });
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

      <Campo
        id={`${id}-limite`}
        rotulo="Limite por mês"
        erro={errors.limite?.message}
        dica="Opcional. Conta só a sua parte das compras, e avisa em 80% e 100%."
      >
        <EntradaEmReais
          {...atributosDeErro(`${id}-limite`, errors.limite?.message)}
          placeholder="500,00"
          {...register('limite')}
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
