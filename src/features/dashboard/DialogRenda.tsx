import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Repeat } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRepositorios } from '@/app/repositorios';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Receita } from '@/data';
import { somarMeses, type Competencia } from '@/domain/competencia';
import { lerReais } from '@/domain/money';
import { receitasDoMes } from '@/domain/resumo';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { formatarDecimal, formatarMoeda, nomeDoMes } from '@/lib/formato';

const valorPositivo = z.string().transform((texto, ctx) => {
  try {
    const centavos = lerReais(texto);
    if (centavos > 0) return centavos;
  } catch {
    // cai no aviso abaixo
  }
  ctx.addIssue({ code: 'custom', message: 'Digite um valor maior que zero' });
  return z.NEVER;
});

const esquema = z.object({
  descricao: z.string().trim().min(1, 'Digite de onde vem'),
  valor: valorPositivo,
  recorrente: z.boolean(),
});

function NovaEntrada({
  onAdicionar,
}: {
  onAdicionar: (dados: z.output<typeof esquema>) => Promise<void>;
}) {
  const id = useId();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: { descricao: '', valor: '', recorrente: true },
  });
  const recorrente = useWatch({ control, name: 'recorrente' });

  return (
    <form
      noValidate
      onSubmit={(e) =>
        void handleSubmit(async (dados) => {
          await onAdicionar(dados);
          reset({ descricao: '', valor: '', recorrente: dados.recorrente });
        })(e)
      }
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
        <Campo id={`${id}-descricao`} rotulo="De onde vem" erro={errors.descricao?.message}>
          <Input
            {...atributosDeErro(`${id}-descricao`, errors.descricao?.message)}
            placeholder="Salário"
            {...register('descricao')}
          />
        </Campo>
        <Campo id={`${id}-valor`} rotulo="Valor" erro={errors.valor?.message}>
          <Input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            inputMode="decimal"
            placeholder="6.500,00"
            className="tabular-nums"
            {...register('valor')}
          />
        </Campo>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Frequência"
          value={recorrente ? 'todo' : 'so'}
          onValueChange={(v) => {
            if (v) setValue('recorrente', v === 'todo');
          }}
        >
          <ToggleGroupItem
            value="todo"
            className="px-3 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
          >
            Todo mês
          </ToggleGroupItem>
          <ToggleGroupItem
            value="so"
            className="px-3 data-[state=on]:bg-brand-subtle data-[state=on]:font-semibold data-[state=on]:text-ink"
          >
            Só neste mês
          </ToggleGroupItem>
        </ToggleGroup>
        <Button type="submit" size="sm">
          Adicionar
        </Button>
      </div>
    </form>
  );
}

export function DialogRenda({
  aberto,
  competencia,
  receitas,
  onFechar,
  onMudou,
}: {
  aberto: boolean;
  competencia: Competencia;
  receitas: Receita[];
  onFechar: () => void;
  onMudou: () => void;
}) {
  const repos = useRepositorios();
  const [alterando, setAlterando] = useState<{ id: number; texto: string } | null>(null);
  const mes = nomeDoMes(competencia).split(' ')[0] ?? '';
  const doMes = receitasDoMes(receitas, competencia);
  const total = doMes.reduce((soma, r) => soma + r.valorCentavos, 0);

  const comDesfazer = (mensagem: string, desfazer: () => Promise<void>) => {
    onMudou();
    toast.success(mensagem, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await desfazer();
            onMudou();
          }),
      },
    });
  };

  const adicionar = (dados: z.output<typeof esquema>) =>
    executar(async () => {
      const id = await repos.receitas.criar({
        descricao: dados.descricao,
        valorCentavos: dados.valor,
        competencia,
        competenciaFim: null,
        recorrente: dados.recorrente,
      });
      comDesfazer(`${dados.descricao} adicionada`, () => repos.receitas.excluir(id));
    });

  const remover = (r: Receita) =>
    executar(async () => {
      if (!r.recorrente || r.competencia === competencia) {
        await repos.receitas.excluir(r.id);
        comDesfazer(`${r.descricao} removida`, () => repos.receitas.restaurar(r.id));
        return;
      }
      await repos.receitas.atualizar(r.id, { competenciaFim: somarMeses(competencia, -1) });
      comDesfazer(`${r.descricao} encerrada a partir de ${mes}`, () =>
        repos.receitas.atualizar(r.id, { competenciaFim: r.competenciaFim }),
      );
    });

  const alterarValor = (r: Receita, texto: string) => {
    setAlterando(null);
    let valorCentavos: number;
    try {
      valorCentavos = lerReais(texto);
    } catch {
      return Promise.resolve();
    }
    if (valorCentavos <= 0 || valorCentavos === r.valorCentavos) return Promise.resolve();
    return executar(async () => {
      if (!r.recorrente || r.competencia === competencia) {
        await repos.receitas.atualizar(r.id, { valorCentavos });
        comDesfazer(`${r.descricao} alterada`, () =>
          repos.receitas.atualizar(r.id, { valorCentavos: r.valorCentavos }),
        );
        return;
      }
      await repos.receitas.atualizar(r.id, { competenciaFim: somarMeses(competencia, -1) });
      const nova = await repos.receitas.criar({ ...r, valorCentavos, competencia });
      comDesfazer(`${r.descricao} alterada a partir de ${mes}`, async () => {
        await repos.receitas.excluir(nova);
        await repos.receitas.atualizar(r.id, { competenciaFim: r.competenciaFim });
      });
    });
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) onFechar();
      }}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Renda de {mes}</DialogTitle>
          <DialogDescription>
            O que entra todo mês continua nos meses seguintes até você remover.
          </DialogDescription>
        </DialogHeader>

        {doMes.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Nenhuma renda em {mes} ainda.</p>
        ) : (
          <ul className="flex flex-col rounded-lg border">
            {doMes.map((r) => (
              <li
                key={r.id}
                className="flex h-12 items-center gap-3 border-t px-4 first:border-t-0"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.descricao}</span>
                  <span className="flex flex-none items-center gap-1 text-xs text-ink-muted">
                    {r.recorrente && <Repeat size={12} strokeWidth={1.75} aria-hidden />}
                    {r.recorrente ? 'Todo mês' : 'Só neste mês'}
                  </span>
                </span>
                {alterando?.id === r.id ? (
                  <Input
                    aria-label={`Novo valor de ${r.descricao}`}
                    inputMode="decimal"
                    value={alterando.texto}
                    ref={(el) => {
                      el?.focus();
                    }}
                    onChange={(e) => {
                      setAlterando({ id: r.id, texto: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void alterarValor(r, alterando.texto);
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setAlterando(null);
                      }
                    }}
                    className="h-8 w-28 text-right tabular-nums"
                  />
                ) : (
                  <span className="text-sm font-semibold tabular-nums">
                    {formatarMoeda(r.valorCentavos)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Alterar valor de ${r.descricao}`}
                  onClick={() => {
                    setAlterando({ id: r.id, texto: formatarDecimal(r.valorCentavos) });
                  }}
                >
                  Alterar
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Remover ${r.descricao}`}
                  className="text-danger-text hover:bg-danger-bg"
                  onClick={() => void remover(r)}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}

        <NovaEntrada onAdicionar={adicionar} />

        <p className="flex justify-between text-sm">
          <span className="text-ink-muted">Total de {mes}</span>
          <span className="font-semibold tabular-nums">{formatarMoeda(total)}</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
