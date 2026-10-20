import { useEffect, useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Cartao, Categoria, Terceiro } from '@/data';
import type { Assinatura } from '@/domain/assinaturas';
import { rateioDaCompra, type ModoDaCompra } from '@/domain/compras';
import { lerReais } from '@/domain/money';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { ComboCategoria } from '@/features/nova-compra/ComboCategoria';
import { entradaDaCompra } from '@/features/nova-compra/NovaCompra';
import { ParaQuem } from '@/features/nova-compra/ParaQuem';
import { formatarDecimal } from '@/lib/formato';

function valorEmCentavos(texto: string): number | null {
  try {
    const centavos = lerReais(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

const esquema = z
  .object({
    nome: z.string().trim().min(1, 'Digite um nome'),
    valor: z.string().refine((t) => valorEmCentavos(t) !== null, 'Digite um valor maior que zero'),
    cartaoId: z.number(),
    dia: z
      .number('Digite um dia de 1 a 31')
      .int('Digite um dia de 1 a 31')
      .min(1, 'Digite um dia de 1 a 31')
      .max(31, 'Digite um dia de 1 a 31'),
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
    valorCentavos: valorEmCentavos(valor) ?? 0,
    rateios: rateioDaCompra(modo, pessoas),
  }));

type Entrada = z.input<typeof esquema>;
export type AssinaturaDoFormulario = z.output<typeof esquema>;

function entradaDaAssinatura(a: Assinatura): Entrada {
  const { modo, pessoas } = entradaDaCompra({
    cartaoId: a.cartaoId,
    descricao: a.nome,
    categoriaId: a.categoriaId,
    valorTotal: a.valorCentavos,
    numParcelas: 1,
    dataCompra: '2000-01-01',
    recorrente: true,
    rateios: a.rateios,
  });
  return {
    nome: a.nome,
    valor: formatarDecimal(a.valorCentavos),
    cartaoId: a.cartaoId,
    dia: a.dia,
    categoriaId: a.categoriaId,
    modo,
    pessoas,
  };
}

export interface DadosDaAssinatura {
  cartoes: Cartao[];
  categorias: Categoria[];
  terceiros: Terceiro[];
}

export function FormularioDeAssinatura({
  dados,
  inicial,
  rodape,
  onSalvar,
}: {
  dados: DadosDaAssinatura;
  inicial?: Assinatura | undefined;
  rodape: React.ReactNode;
  onSalvar: (assinatura: AssinaturaDoFormulario) => Promise<void>;
}) {
  const id = useId();
  const categoriaPadrao =
    dados.categorias.find((c) => c.nome.toLowerCase() === 'assinaturas')?.id ?? null;
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitted },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: inicial
      ? entradaDaAssinatura(inicial)
      : {
          nome: '',
          valor: '',
          cartaoId: dados.cartoes[0]?.id ?? 0,
          dia: new Date().getDate(),
          categoriaId: categoriaPadrao,
          modo: 'minha',
          pessoas: [],
        },
  });
  const [modo, pessoas, categoriaId] = useWatch({
    control,
    name: ['modo', 'pessoas', 'categoriaId'],
  });
  const revalidar = { shouldValidate: isSubmitted };

  useEffect(() => {
    setFocus('nome');
  }, [setFocus]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((assinatura) => executar(() => onSalvar(assinatura)))();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-4">
        <Campo id={`${id}-nome`} rotulo="Nome" erro={errors.nome?.message}>
          <Input
            {...atributosDeErro(`${id}-nome`, errors.nome?.message)}
            placeholder="Ex.: Streaming"
            autoComplete="off"
            {...register('nome')}
          />
        </Campo>
        <Campo id={`${id}-valor`} rotulo="Valor por mês" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valor')}
          />
        </Campo>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-cartao`}>Cartão</Label>
          <Controller
            control={control}
            name="cartaoId"
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(v) => {
                  field.onChange(Number(v));
                }}
              >
                <SelectTrigger id={`${id}-cartao`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dados.cartoes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span
                        aria-hidden
                        style={{ backgroundColor: c.cor }}
                        className="h-[11px] w-4 flex-none rounded-sm"
                      />
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <Campo id={`${id}-dia`} rotulo="Cobra dia" erro={errors.dia?.message}>
          <Input
            {...atributosDeErro(`${id}-dia`, errors.dia?.message)}
            type="number"
            min={1}
            max={31}
            className="tabular-nums"
            {...register('dia', { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-categoria`}>Categoria</Label>
        <ComboCategoria
          id={`${id}-categoria`}
          categorias={dados.categorias}
          valor={categoriaId}
          sugerida={false}
          onEscolher={(escolhida) => {
            setValue('categoriaId', escolhida);
          }}
        />
      </div>

      <ParaQuem
        id={`${id}-quem`}
        modo={modo}
        pessoas={pessoas}
        terceiros={dados.terceiros}
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

export function BotoesDoFormulario({ onCancelar }: { onCancelar: () => void }) {
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
