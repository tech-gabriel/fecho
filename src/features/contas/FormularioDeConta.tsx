import { useEffect, useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Categoria, ContaFixa, Terceiro } from '@/data';
import { rateioDaCompra, type ModoDaCompra } from '@/domain/compras';
import { lerReais } from '@/domain/money';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { EntradaEmReais } from '@/features/cadastros/formularios';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { ComboCategoria } from '@/features/nova-compra/ComboCategoria';
import { entradaDaCompra } from '@/features/nova-compra/NovaCompra';
import { ParaQuem } from '@/features/nova-compra/ParaQuem';
import { entradaDeInteiro } from '@/lib/entrada';
import { formatarDecimal } from '@/lib/formato';

export function valorPositivo(texto: string): number | null {
  try {
    const centavos = lerReais(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

const esquema = z
  .object({
    descricao: z.string().trim().min(1, 'Digite uma descrição').max(80, 'Use até 80 letras'),
    valor: z.string().refine((t) => valorPositivo(t) !== null, 'Digite um valor maior que zero'),
    dia: z
      .number('Digite um dia de 1 a 31')
      .int('Digite um dia de 1 a 31')
      .min(1, 'Digite um dia de 1 a 31')
      .max(31, 'Digite um dia de 1 a 31'),
    inicio: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Escolha o mês'),
    categoriaId: z.number().nullable(),
    modo: z.enum(['minha', 'outra', 'dividida']),
    pessoas: z.array(z.object({ terceiroId: z.number(), percentual: z.number() })),
  })
  .superRefine(({ modo, pessoas }, ctx) => {
    try {
      rateioDaCompra(modo, pessoas);
    } catch (erro) {
      ctx.addIssue({ code: 'custom', path: ['pessoas'], message: (erro as Error).message });
    }
  })
  .transform(({ valor, modo, pessoas, ...dados }) => ({
    ...dados,
    valorCentavos: valorPositivo(valor) ?? 0,
    rateios: rateioDaCompra(modo, pessoas),
  }));

export type ContaDoFormulario = z.output<typeof esquema>;

function divisaoInicial(conta: ContaFixa | undefined) {
  if (!conta) return { modo: 'minha' as ModoDaCompra, pessoas: [] };
  const { modo, pessoas } = entradaDaCompra({
    cartaoId: 0,
    descricao: conta.descricao,
    categoriaId: conta.categoriaId,
    valorTotal: conta.valorCentavos,
    numParcelas: 1,
    dataCompra: '2000-01-01',
    recorrente: false,
    rateios: conta.rateios,
  });
  return { modo, pessoas };
}

export function FormularioDeConta({
  categorias,
  terceiros,
  inicial,
  inicioPadrao,
  rodape,
  onSalvar,
}: {
  categorias: Categoria[];
  terceiros: Terceiro[];
  inicial?: ContaFixa | undefined;
  inicioPadrao: string;
  rodape: React.ReactNode;
  onSalvar: (conta: ContaDoFormulario) => Promise<void>;
}) {
  const id = useId();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitted },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      descricao: inicial?.descricao ?? '',
      valor: inicial ? formatarDecimal(inicial.valorCentavos) : '',
      dia: inicial?.dia ?? 10,
      inicio: inicial?.inicio ?? inicioPadrao,
      categoriaId: inicial?.categoriaId ?? null,
      ...divisaoInicial(inicial),
    },
  });
  const [categoriaId, modo, pessoas] = useWatch({
    control,
    name: ['categoriaId', 'modo', 'pessoas'],
  });
  const revalidar = { shouldValidate: isSubmitted };

  useEffect(() => {
    setFocus('descricao');
  }, [setFocus]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((conta) => executar(() => onSalvar(conta)))();
      }}
      className="flex flex-col gap-4"
    >
      <Campo id={`${id}-descricao`} rotulo="Descrição" erro={errors.descricao?.message}>
        <Input
          {...atributosDeErro(`${id}-descricao`, errors.descricao?.message)}
          maxLength={80}
          placeholder="Ex.: Plano de saúde"
          autoComplete="off"
          {...register('descricao')}
        />
      </Campo>

      <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] gap-4">
        <Campo
          id={`${id}-valor`}
          rotulo="Valor por mês"
          erro={errors.valor?.message}
          dica="Se mudar num mês, ajuste ao marcar como paga."
        >
          <EntradaEmReais
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            placeholder="0,00"
            autoComplete="off"
            {...register('valor')}
          />
        </Campo>
        <Campo id={`${id}-dia`} rotulo="Vence dia" erro={errors.dia?.message}>
          <Input
            {...atributosDeErro(`${id}-dia`, errors.dia?.message)}
            {...entradaDeInteiro(2)}
            className="tabular-nums"
            {...register('dia', { valueAsNumber: true })}
          />
        </Campo>
        <Campo id={`${id}-inicio`} rotulo="Começa em" erro={errors.inicio?.message}>
          <Input
            {...atributosDeErro(`${id}-inicio`, errors.inicio?.message)}
            type="month"
            {...register('inicio')}
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-categoria`}>Categoria</Label>
        <ComboCategoria
          id={`${id}-categoria`}
          categorias={categorias}
          valor={categoriaId}
          sugerida={false}
          onEscolher={(escolhida) => {
            setValue('categoriaId', escolhida);
          }}
        />
      </div>

      <ParaQuem
        id={`${id}-quem`}
        periodo="mês"
        modo={modo}
        pessoas={pessoas}
        terceiros={terceiros}
        erro={errors.pessoas?.message}
        onModo={(novo: ModoDaCompra) => {
          setValue('modo', novo, revalidar);
        }}
        onPessoas={(novas) => {
          setValue('pessoas', novas, revalidar);
        }}
      />

      {rodape}
    </form>
  );
}
