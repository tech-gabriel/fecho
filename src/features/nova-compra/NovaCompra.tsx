import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, CreditCard, TriangleAlert } from 'lucide-react';
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
import type { Cartao, Categoria, PagamentoDeFatura, Repositorios, Terceiro } from '@/data';
import {
  type DadosNovaCompra,
  previaDaCompra,
  rateioDaCompra,
  sugerirCategoria,
  type ModoDaCompra,
} from '@/domain/compras';
import { competenciaDe, diaDe } from '@/domain/competencia';
import { competenciaDaCompra } from '@/domain/faturas';
import { lerReais } from '@/domain/money';
import { formatarDecimal, nomeDoMes } from '@/lib/formato';
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
export type CompraDoFormulario = z.output<typeof esquema>;

export function entradaDaCompra(compra: DadosNovaCompra): Entrada {
  const pessoas = compra.rateios.flatMap((r) =>
    r.terceiroId === null ? [] : [{ terceiroId: r.terceiroId, percentual: r.percentual }],
  );
  const modo: ModoDaCompra =
    pessoas.length === 0
      ? 'minha'
      : pessoas.length === 1 && pessoas[0]?.percentual === 100
        ? 'outra'
        : 'dividida';
  return {
    valor: formatarDecimal(compra.valorTotal),
    descricao: compra.descricao,
    categoriaId: compra.categoriaId,
    cartaoId: compra.cartaoId,
    dataCompra: compra.dataCompra,
    modo,
    pessoas,
    numParcelas: compra.numParcelas,
    recorrente: compra.recorrente,
    observacao: compra.observacao ?? '',
  };
}

function calcularPrevia(
  valor: string,
  cartao: Cartao | undefined,
  numParcelas: number,
  dataCompra: string,
  modo: ModoDaCompra,
  pessoas: Entrada['pessoas'],
) {
  const valorTotal = valorEmCentavos(valor);
  if (!valorTotal || !cartao) return null;
  const compra = { valorTotal, numParcelas, dataCompra };
  try {
    return previaDaCompra({ ...compra, rateios: rateioDaCompra(modo, pessoas) }, cartao);
  } catch {
    try {
      return previaDaCompra({ ...compra, rateios: [] }, cartao);
    } catch {
      return null;
    }
  }
}

export interface DadosDoFormulario {
  cartoes: Cartao[];
  categorias: Categoria[];
  terceiros: Terceiro[];
  historico: { descricao: string; categoriaId: number }[];
  pagamentos: PagamentoDeFatura[];
}

async function carregarDados(repos: Repositorios, manter?: DadosNovaCompra) {
  const [cartoes, categorias, terceiros, historico, pagamentos] = await Promise.all([
    repos.cartoes.listar(),
    repos.categorias.listar(),
    repos.terceiros.listar(),
    repos.compras.ultimasCategorias(),
    repos.faturas.pagamentos(),
  ]);
  const usados = new Set(manter?.rateios.map((r) => r.terceiroId));
  return {
    cartoes: cartoes.filter((c) => c.ativo || c.id === manter?.cartaoId),
    categorias: categorias.filter((c) => c.ativo || c.id === manter?.categoriaId),
    terceiros: terceiros.filter((t) => t.ativo || usados.has(t.id)),
    historico,
    pagamentos,
  };
}

export function useDadosDoFormulario(ativo: boolean, manter?: DadosNovaCompra) {
  const repos = useRepositorios();
  const [dados, setDados] = useState<DadosDoFormulario | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let montado = true;
    void carregarDados(repos, manter).then((carregados) => {
      if (montado) setDados(carregados);
    });
    return () => {
      montado = false;
      setDados(null);
    };
  }, [ativo, repos, manter]);

  return dados;
}

export function NovaCompra() {
  const aberta = useApp((s) => s.novaCompraAberta);
  const preenchida = useApp((s) => s.novaCompraPreenchida);
  const fechar = useApp((s) => s.fecharNovaCompra);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const repos = useRepositorios();
  const dados = useDadosDoFormulario(aberta);

  const salvar = async (compra: CompraDoFormulario, abrirOutra: boolean) => {
    const assinaturaId = compra.recorrente ? await criarAssinatura(compra) : null;
    let compraId: number;
    try {
      compraId = await repos.compras.salvar(
        assinaturaId === null
          ? compra
          : { ...compra, assinatura: { id: assinaturaId, mes: competenciaDe(compra.dataCompra) } },
      );
    } catch (erro) {
      if (assinaturaId !== null) await repos.assinaturas.excluir(assinaturaId);
      throw erro;
    }
    gravarUltimoCartao(compra.cartaoId);
    dadosMudaram();
    toast.success(
      assinaturaId === null
        ? 'Compra registrada'
        : 'Compra registrada. A cobrança entra sozinha todo mês.',
      {
        action: {
          label: 'Desfazer',
          onClick: () =>
            void executar(async () => {
              await repos.compras.excluir(compraId);
              if (assinaturaId !== null) await repos.assinaturas.excluir(assinaturaId);
              dadosMudaram();
            }),
        },
      },
    );
    if (!abrirOutra) fechar();
  };

  const criarAssinatura = (compra: CompraDoFormulario) =>
    repos.assinaturas.criar({
      nome: compra.descricao.trim(),
      cartaoId: compra.cartaoId,
      categoriaId: compra.categoriaId,
      valorCentavos: compra.valorTotal,
      dia: diaDe(compra.dataCompra),
      rateios: [...compra.rateios],
      ativa: true,
      inicio: competenciaDe(compra.dataCompra),
    });

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
        {dados &&
          (dados.cartoes.length === 0 ? (
            <SemCartao />
          ) : (
            <FormularioDeCompra
              modo="nova"
              dados={dados}
              inicial={
                preenchida
                  ? entradaDaCompra({ ...preenchida, dataCompra: hojeLocal(), recorrente: false })
                  : undefined
              }
              onSalvar={salvar}
              onCancelar={fechar}
            />
          ))}
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

export function FormularioDeCompra({
  modo: modoDoFormulario,
  dados,
  inicial,
  competenciasAtuais = [],
  onSalvar,
  onCancelar,
}: {
  modo: 'nova' | 'edicao';
  dados: DadosDoFormulario;
  inicial?: Entrada | undefined;
  competenciasAtuais?: string[];
  onSalvar: (compra: CompraDoFormulario, abrirOutra: boolean) => Promise<void>;
  onCancelar: () => void;
}) {
  const id = useId();
  const hoje = hojeLocal();
  const nova = modoDoFormulario === 'nova';
  const [categoriaAMao, setCategoriaAMao] = useState(inicial !== undefined);
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
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: inicial ?? vazio(cartaoInicial, hoje),
  });

  const [valor, cartaoId, dataCompra, modo, pessoas, numParcelas, categoriaId] = useWatch({
    control,
    name: ['valor', 'cartaoId', 'dataCompra', 'modo', 'pessoas', 'numParcelas', 'categoriaId'],
  });
  const cartao = dados.cartoes.find((c) => c.id === cartaoId);
  const revalidar = { shouldValidate: isSubmitted };
  const faturaDaCompra = cartao ? competenciaDaCompra(dataCompra, cartao.diaFechamento) : null;
  const pagas = (cartao: number, competencias: (string | null)[]) =>
    dados.pagamentos
      .filter((p) => p.cartaoId === cartao && competencias.includes(p.competencia))
      .map((p) => nomeDoMes(p.competencia).split(' ')[0] ?? '');
  const aviso = nova
    ? pagas(cartaoId, [faturaDaCompra]).length > 0 && cartao && faturaDaCompra
      ? `A fatura de ${nomeDoMes(faturaDaCompra).split(' ')[0] ?? ''} do ${cartao.nome} já foi paga. A compra entra nela mesmo assim.`
      : null
    : pagas(inicial?.cartaoId ?? cartaoId, competenciasAtuais).length > 0
      ? `Esta compra tem parcelas em faturas já pagas: ${pagas(inicial?.cartaoId ?? cartaoId, competenciasAtuais).join(', ')}. Alterar muda o total delas.`
      : null;

  const previa = calcularPrevia(valor, cartao, numParcelas, dataCompra, modo, pessoas);

  const salvar = (abrirOutra: boolean) =>
    handleSubmit((compra) =>
      executar(async () => {
        const outra = nova && abrirOutra;
        await onSalvar(compra, outra);
        if (!outra) return;
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
            <span className="font-normal text-ink-muted">
              {nova ? '· repetir todo mês, observação' : '· observação'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-2">
          {nova && (
            <div className="flex items-start gap-2">
              <Controller
                control={control}
                name="recorrente"
                render={({ field }) => (
                  <Checkbox
                    id={`${id}-recorrente`}
                    aria-describedby={`${id}-recorrente-dica`}
                    checked={field.value}
                    onCheckedChange={(marcado) => {
                      field.onChange(marcado === true);
                    }}
                  />
                )}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`${id}-recorrente`}>Repetir todo mês</Label>
                <span id={`${id}-recorrente-dica`} className="text-xs text-ink-muted">
                  Cria uma assinatura: a cobrança entra sozinha todo mês.
                </span>
              </div>
            </div>
          )}
          <Campo id={`${id}-observacao`} rotulo="Observação">
            <Textarea id={`${id}-observacao`} rows={2} {...register('observacao')} />
          </Campo>
        </CollapsibleContent>
      </Collapsible>

      {aviso && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md bg-warning-bg px-3 py-2 text-[13px] text-warning-text"
        >
          <TriangleAlert
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="mt-px flex-none text-warning"
          />
          {aviso}
        </p>
      )}

      <DialogFooter className="items-center">
        <span className="flex-1 text-xs text-ink-muted">
          {nova && 'Shift+Enter salva e abre outra'}
        </span>
        <Button type="button" variant="outline" onClick={onCancelar}>
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
