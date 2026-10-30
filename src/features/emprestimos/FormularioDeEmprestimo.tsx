import { entradaDeDinheiro, entradaDeInteiro } from '@/lib/entrada';
import { useEffect, useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { hojeLocal } from '@/app/store';
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
import type { EmprestimoConcedido, EmprestimoTomado, Novo, Terceiro } from '@/data';
import { competenciaDe } from '@/domain/competencia';
import { lerReais } from '@/domain/money';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { SeletorData } from '@/features/nova-compra/SeletorData';
import { formatarDecimal, formatarMoeda } from '@/lib/formato';

function emCentavos(texto: string): number | null {
  try {
    const centavos = lerReais(texto);
    return centavos > 0 ? centavos : null;
  } catch {
    return null;
  }
}

const valor = z.string().refine((t) => emCentavos(t) !== null, 'Digite um valor maior que zero');
const inteiro = (min: number, max: number, mensagem: string) =>
  z.number(mensagem).int(mensagem).min(min, mensagem).max(max, mensagem);

const esquemaTomado = z
  .object({
    descricao: z.string().trim().min(1, 'Digite um nome').max(80, 'Use até 80 letras'),
    valor,
    numParcelas: inteiro(1, 360, 'Digite de 1 a 360 parcelas'),
    valorParcela: valor,
    dia: inteiro(1, 31, 'Digite um dia de 1 a 31'),
    inicio: z.string().regex(/^\d{4}-\d{2}$/, 'Escolha o mês da 1ª parcela'),
    data: z.string(),
  })
  .transform(({ valor: v, valorParcela, ...resto }) => ({
    ...resto,
    valorCentavos: emCentavos(v) ?? 0,
    valorParcelaCentavos: emCentavos(valorParcela) ?? 0,
  }));

const esquemaConcedido = z
  .object({
    terceiroId: z.number('Escolha a pessoa'),
    valor,
    data: z.string(),
    prazo: z.string(),
  })
  .refine((d) => d.prazo >= d.data, {
    path: ['prazo'],
    message: 'A devolução não pode ser antes do empréstimo',
  })
  .transform(({ valor: v, ...resto }) => ({
    ...resto,
    descricao: 'Empréstimo',
    valorCentavos: emCentavos(v) ?? 0,
  }));

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

export function FormularioTomado({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial?: EmprestimoTomado | undefined;
  onSalvar: (dados: Novo<EmprestimoTomado>) => Promise<void>;
  onCancelar: () => void;
}) {
  const id = useId();
  const hoje = hojeLocal();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaTomado),
    defaultValues: inicial
      ? {
          descricao: inicial.descricao,
          valor: formatarDecimal(inicial.valorCentavos),
          numParcelas: inicial.numParcelas,
          valorParcela: formatarDecimal(inicial.valorParcelaCentavos),
          dia: inicial.dia,
          inicio: inicial.inicio,
          data: inicial.data,
        }
      : {
          descricao: 'Empréstimo pessoal',
          valor: '',
          numParcelas: 12,
          valorParcela: '',
          dia: Number(hoje.slice(8)),
          inicio: competenciaDe(hoje),
          data: hoje,
        },
  });
  const [v, n, parcela, data] = useWatch({
    control,
    name: ['valor', 'numParcelas', 'valorParcela', 'data'],
  });
  const recebido = emCentavos(v);
  const daParcela = emCentavos(parcela);
  const total = daParcela && Number.isInteger(n) && n > 0 ? daParcela * n : null;

  useEffect(() => {
    setFocus('valor');
  }, [setFocus]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((dados) => executar(() => onSalvar(dados)))();
      }}
      className="flex flex-col gap-4"
    >
      <Campo id={`${id}-descricao`} rotulo="Nome" erro={errors.descricao?.message}>
        <Input
          {...atributosDeErro(`${id}-descricao`, errors.descricao?.message)}
          autoComplete="off"
          maxLength={80}
          {...register('descricao')}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-valor`} rotulo="Quanto você recebeu" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            {...entradaDeDinheiro}
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valor')}
          />
        </Campo>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-data`}>Pego em</Label>
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
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-parcelas`} rotulo="Parcelas" erro={errors.numParcelas?.message}>
          <Input
            {...atributosDeErro(`${id}-parcelas`, errors.numParcelas?.message)}
            {...entradaDeInteiro(2)}
            className="tabular-nums"
            {...register('numParcelas', { valueAsNumber: true })}
          />
        </Campo>
        <Campo
          id={`${id}-valor-parcela`}
          rotulo="Valor da parcela"
          erro={errors.valorParcela?.message}
        >
          <Input
            {...atributosDeErro(`${id}-valor-parcela`, errors.valorParcela?.message)}
            {...entradaDeDinheiro}
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valorParcela')}
          />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-dia`} rotulo="Debitada no dia" erro={errors.dia?.message}>
          <Input
            {...atributosDeErro(`${id}-dia`, errors.dia?.message)}
            {...entradaDeInteiro(2)}
            className="tabular-nums"
            {...register('dia', { valueAsNumber: true })}
          />
        </Campo>
        <Campo id={`${id}-inicio`} rotulo="1ª parcela em" erro={errors.inicio?.message}>
          <Input
            {...atributosDeErro(`${id}-inicio`, errors.inicio?.message)}
            type="month"
            {...register('inicio')}
          />
        </Campo>
      </div>
      {total !== null && recebido !== null && (
        <p role="status" className="rounded-md bg-soft px-3 py-2 text-[13px]">
          Vai pagar {formatarMoeda(total)} ao todo · juros {formatarMoeda(total - recebido)}
        </p>
      )}
      <Rodape onCancelar={onCancelar} />
    </form>
  );
}

export function FormularioConcedido({
  terceiros,
  inicial,
  onSalvar,
  onCancelar,
}: {
  terceiros: Terceiro[];
  inicial?: EmprestimoConcedido | undefined;
  onSalvar: (dados: Novo<EmprestimoConcedido>) => Promise<void>;
  onCancelar: () => void;
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
    resolver: zodResolver(esquemaConcedido),
    defaultValues: inicial
      ? {
          terceiroId: inicial.terceiroId,
          valor: formatarDecimal(inicial.valorCentavos),
          data: inicial.data,
          prazo: inicial.prazo,
        }
      : { terceiroId: terceiros[0]?.id ?? 0, valor: '', data: hoje, prazo: hoje },
  });
  const [data, prazo] = useWatch({ control, name: ['data', 'prazo'] });

  if (terceiros.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        Cadastre a pessoa em Configurações para registrar o empréstimo.
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit((dados) => executar(() => onSalvar(dados)))();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-pessoa`} rotulo="Para quem" erro={errors.terceiroId?.message}>
          <Controller
            control={control}
            name="terceiroId"
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(v) => {
                  field.onChange(Number(v));
                }}
              >
                <SelectTrigger id={`${id}-pessoa`} className="w-full">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {terceiros.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Campo>
        <Campo id={`${id}-valor`} rotulo="Valor" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            {...entradaDeDinheiro}
            placeholder="0,00"
            autoComplete="off"
            className="text-right tabular-nums"
            {...register('valor')}
          />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-data`}>Emprestei em</Label>
          <SeletorData
            id={`${id}-data`}
            valor={data}
            hoje={hoje}
            onEscolher={(escolhida) => {
              setValue('data', escolhida);
            }}
          />
        </div>
        <Campo id={`${id}-prazo`} rotulo="Devolve até" erro={errors.prazo?.message}>
          <SeletorData
            id={`${id}-prazo`}
            valor={prazo}
            hoje={hoje}
            onEscolher={(escolhida) => {
              setValue('prazo', escolhida, { shouldValidate: true });
            }}
          />
        </Campo>
      </div>
      <Rodape onCancelar={onCancelar} />
    </form>
  );
}
