import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, CreditCard } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Kbd } from '@/app/layout/apoio';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import type { Cartao, Categoria, Terceiro } from '@/data';
import {
  previaDaCompra,
  rateioDaCompra,
  sugerirCategoria,
  type ModoDaCompra,
} from '@/domain/compras';
import { lerReais } from '@/domain/money';
import { MAXIMO_DE_PARCELAS } from '@/domain/parcelas';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { ComboCategoria } from './ComboCategoria';
import { ParaQuem } from './ParaQuem';
import { Parcelas, PreviaDasParcelas } from './Parcelas';
import { SeletorData } from './SeletorData';

const CHAVE_ULTIMO_CARTAO = 'fecho:ultimo-cartao';

function lerUltimoCartao(): number | null {
  try {
    return Number(localStorage.getItem(CHAVE_ULTIMO_CARTAO)) || null;
  } catch {
    return null;
  }
}

function gravarUltimoCartao(id: number) {
  try {
    localStorage.setItem(CHAVE_ULTIMO_CARTAO, String(id));
  } catch {
    // sem armazenamento, o próximo Dialog começa no primeiro cartão
  }
}

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
    valor: z.string().refine((t) => valorEmCentavos(t) !== null, 'Digite um valor maior que zero'),
    descricao: z.string().trim().min(1, 'Digite uma descrição'),
    categoriaId: z.number().nullable(),
    cartaoId: z.number(),
    dataCompra: z.string(),
    modo: z.enum(['minha', 'outra', 'dividida']),
    pessoas: z.array(z.object({ terceiroId: z.number(), percentual: z.number() })),
    numParcelas: z
      .number()
      .refine((n) => Number.isInteger(n) && n >= 1, 'Digite um número de parcelas')
      .refine((n) => n <= MAXIMO_DE_PARCELAS, 'O máximo é 24 parcelas'),
    recorrente: z.boolean(),
    observacao: z.string(),
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
    valorTotal: valorEmCentavos(valor) ?? 0,
    rateios: rateioDaCompra(modo, pessoas),
  }));

type Entrada = z.input<typeof esquema>;

interface Dados {
  cartoes: Cartao[];
  categorias: Categoria[];
  terceiros: Terceiro[];
  historico: { descricao: string; categoriaId: number }[];
}

export function NovaCompra() {
  const aberta = useApp((s) => s.novaCompraAberta);
  const fechar = useApp((s) => s.fecharNovaCompra);
  const repos = useRepositorios();
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    if (!aberta) return;
    let montado = true;
    void Promise.all([
      repos.cartoes.listar(),
      repos.categorias.listar(),
      repos.terceiros.listar(),
      repos.compras.ultimasCategorias(),
    ]).then(([cartoes, categorias, terceiros, historico]) => {
      if (!montado) return;
      setDados({
        cartoes: cartoes.filter((c) => c.ativo),
        categorias: categorias.filter((c) => c.ativo),
        terceiros: terceiros.filter((t) => t.ativo),
        historico,
      });
    });
    return () => {
      montado = false;
      setDados(null);
    };
  }, [aberta, repos]);

  return (
    <Dialog
      open={aberta}
      onOpenChange={(abrir) => {
        if (!abrir) fechar();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[560px] gap-4 overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova compra</DialogTitle>
          <DialogDescription className="sr-only">
            Registre uma compra no cartão. Enter salva, Shift+Enter salva e abre outra.
          </DialogDescription>
        </DialogHeader>
        {dados && (dados.cartoes.length === 0 ? <SemCartao /> : <Formulario dados={dados} />)}
      </DialogContent>
    </Dialog>
  );
}

function SemCartao() {
  const fechar = useApp((s) => s.fecharNovaCompra);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-soft">
        <CreditCard size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
      </span>
      <p className="text-sm text-ink-muted">Cadastre um cartão para registrar compras.</p>
      <Button
        onClick={() => {
          fechar();
          void navigate('/configuracoes');
        }}
      >
        Adicionar cartão
      </Button>
    </div>
  );
}

function Formulario({ dados }: { dados: Dados }) {
  const id = useId();
  const repos = useRepositorios();
  const fechar = useApp((s) => s.fecharNovaCompra);
  const hoje = hojeLocal();
  const [categoriaAMao, setCategoriaAMao] = useState(false);
  const [maisOpcoes, setMaisOpcoes] = useState(false);

  const ultimo = lerUltimoCartao();
  const cartaoInicial = (dados.cartoes.find((c) => c.id === ultimo) ?? dados.cartoes[0])?.id ?? 0;
  const vazio = (cartaoId: number, dataCompra: string): Entrada => ({
    valor: '',
    descricao: '',
    categoriaId: null,
    cartaoId,
    dataCompra,
    modo: 'minha',
    pessoas: [],
    numParcelas: 1,
    recorrente: false,
    observacao: '',
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setFocus,
    formState: { errors, isSubmitted },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: vazio(cartaoInicial, hoje) });

  const [valor, cartaoId, dataCompra, modo, pessoas, numParcelas, categoriaId] = useWatch({
    control,
    name: ['valor', 'cartaoId', 'dataCompra', 'modo', 'pessoas', 'numParcelas', 'categoriaId'],
  });
  const cartao = dados.cartoes.find((c) => c.id === cartaoId);
  const revalidar = { shouldValidate: isSubmitted };

  const previa = useMemo(() => {
    const valorTotal = valorEmCentavos(valor);
    if (!valorTotal || !cartao) return null;
    try {
      return previaDaCompra(
        { valorTotal, numParcelas, dataCompra, rateios: rateioDaCompra(modo, pessoas) },
        cartao,
      );
    } catch {
      try {
        return previaDaCompra({ valorTotal, numParcelas, dataCompra, rateios: [] }, cartao);
      } catch {
        return null;
      }
    }
  }, [valor, cartao, numParcelas, dataCompra, modo, pessoas]);

  const salvar = (abrirOutra: boolean) =>
    handleSubmit((compra) =>
      executar(async () => {
        const compraId = await repos.compras.salvar(compra);
        gravarUltimoCartao(compra.cartaoId);
        toast.success('Compra registrada', {
          action: {
            label: 'Desfazer',
            onClick: () => void executar(() => repos.compras.excluir(compraId)),
          },
        });
        if (!abrirOutra) {
          fechar();
          return;
        }
        reset(vazio(compra.cartaoId, compra.dataCompra));
        setCategoriaAMao(false);
        setMaisOpcoes(false);
        setFocus('valor');
      }),
    )();

  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setFocus('valor');
  }, [setFocus]);

  const aoEnter = useEffectEvent((abrirOutra: boolean) => {
    void salvar(abrirOutra);
  });
  const alternarMaisOpcoes = useEffectEvent(() => {
    setMaisOpcoes((aberto) => !aberto);
  });

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        alternarMaisOpcoes();
        return;
      }
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest('textarea, button, [cmdk-root], [role="listbox"], [role="grid"]')) return;
      e.preventDefault();
      aoEnter(e.shiftKey);
    };
    const form = formulario.current;
    form?.addEventListener('keydown', aoTeclar);
    return () => {
      form?.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  const sugerir = (descricao: string) => {
    if (categoriaAMao) return;
    setValue('categoriaId', sugerirCategoria(descricao, dados.historico, dados.categorias));
  };

  return (
    <form
      noValidate
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        void salvar(false);
      }}
      className="flex flex-col gap-4"
    >
      <Campo id={`${id}-valor`} rotulo="Valor" erro={errors.valor?.message}>
        <div
          className={`flex h-14 items-center gap-2 rounded-md border px-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--focus-ring) ${errors.valor ? 'border-danger' : 'border-border-strong'}`}
        >
          <span aria-hidden className="text-xl text-ink-muted">
            R$
          </span>
          <input
            {...atributosDeErro(`${id}-valor`, errors.valor?.message)}
            {...register('valor')}
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[28px] leading-[34px] font-bold tabular-nums placeholder:text-ink-muted focus-visible:outline-none"
          />
        </div>
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo id={`${id}-descricao`} rotulo="Descrição" erro={errors.descricao?.message}>
          <Input
            {...atributosDeErro(`${id}-descricao`, errors.descricao?.message)}
            placeholder="Ex.: Mercado"
            autoComplete="off"
            {...register('descricao', {
              onChange: (e: { target: { value: string } }) => {
                sugerir(e.target.value);
              },
            })}
          />
        </Campo>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-categoria`}>Categoria</Label>
          <ComboCategoria
            id={`${id}-categoria`}
            categorias={dados.categorias}
            valor={categoriaId}
            sugerida={!categoriaAMao}
            onEscolher={(escolhida) => {
              setCategoriaAMao(true);
              setValue('categoriaId', escolhida);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4">
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
                      <span className="text-xs text-ink-muted">fecha dia {c.diaFechamento}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-data`}>Data</Label>
          <SeletorData
            id={`${id}-data`}
            valor={dataCompra}
            hoje={hoje}
            onEscolher={(data) => {
              setValue('dataCompra', data);
            }}
          />
        </div>
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

      <div className="flex flex-col gap-3">
        <Parcelas
          id={`${id}-parcelas`}
          numParcelas={numParcelas}
          erro={errors.numParcelas?.message}
          onEscolher={(n) => {
            setValue('numParcelas', n, revalidar);
          }}
        />
        <PreviaDasParcelas previa={previa} cartao={cartao} terceiros={dados.terceiros} />
      </div>

      <Collapsible open={maisOpcoes} onOpenChange={setMaisOpcoes}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-keyshortcuts="Alt+M"
            className="-ml-2 self-start"
          >
            <ChevronDown
              strokeWidth={1.75}
              className={maisOpcoes ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
            Mais opções
            <span className="font-normal text-ink-muted">· repetir todo mês, observação</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="recorrente"
              render={({ field }) => (
                <Checkbox
                  id={`${id}-recorrente`}
                  checked={field.value}
                  onCheckedChange={(marcado) => {
                    field.onChange(marcado === true);
                  }}
                />
              )}
            />
            <Label htmlFor={`${id}-recorrente`}>Repetir todo mês</Label>
          </div>
          <Campo id={`${id}-observacao`} rotulo="Observação">
            <Textarea id={`${id}-observacao`} rows={2} {...register('observacao')} />
          </Campo>
        </CollapsibleContent>
      </Collapsible>

      <DialogFooter className="items-center">
        <span className="flex-1 text-xs text-ink-muted">Shift+Enter salva e abre outra</span>
        <Button type="button" variant="outline" onClick={fechar}>
          Cancelar
        </Button>
        <Button type="submit" className="pr-2 font-semibold">
          Salvar
          <Kbd className="bg-on-brand/12 text-on-brand">Enter</Kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}
