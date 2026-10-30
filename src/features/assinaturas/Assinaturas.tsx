import { useEffect, useState } from 'react';
import { Pause, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import type { Assinatura, Cartao, Categoria, Receita, Terceiro } from '@/data';
import { proximaCobranca, resumoDasAssinaturas } from '@/domain/assinaturas';
import { competenciaDe, type DataLocal } from '@/domain/competencia';
import { somar } from '@/domain/money';
import { receitasDoMes } from '@/domain/resumo';
import type { Rateio } from '@/domain/terceiros';
import { executar } from '@/features/cadastros/SecaoCadastro';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda } from '@/lib/formato';
import {
  BotoesDoFormulario,
  FormularioDeAssinatura,
  type AssinaturaDoFormulario,
} from './FormularioDeAssinatura';

interface Dados {
  assinaturas: Assinatura[];
  cartoes: Cartao[];
  categorias: Categoria[];
  terceiros: Terceiro[];
  receitas: Receita[];
}

// começa na próxima cobrança: um dia que já passou neste mês não é lançado de novo
export function inicioDaAssinatura(dia: number, hoje: DataLocal) {
  return competenciaDe(
    proximaCobranca(
      {
        id: 0,
        nome: '',
        cartaoId: 0,
        categoriaId: null,
        valorCentavos: 1,
        dia,
        rateios: [],
        ativa: true,
        inicio: competenciaDe(hoje),
      },
      hoje,
    ),
  );
}

export function quemPaga(
  { rateios }: { rateios: readonly Rateio[] },
  terceiros: Terceiro[],
): string | null {
  const deles = rateios.filter((r) => r.terceiroId !== null);
  if (deles.length === 0) return null;
  const nome = (id: number | null) => terceiros.find((t) => t.id === id)?.nome ?? '';
  if (deles.length > 1) return `Dividida com ${deles.map((r) => nome(r.terceiroId)).join(' e ')}`;
  const [r] = deles;
  if (!r) return null;
  const parte = r.percentual === 100 ? 'tudo' : r.percentual === 50 ? 'metade' : `${r.percentual}%`;
  return `${nome(r.terceiroId)} paga ${parte}`;
}

export function Assinaturas() {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [dados, setDados] = useState<Dados | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Assinatura | null>(null);
  const hoje = hojeLocal();

  useEffect(() => {
    let montado = true;
    void Promise.all([
      repos.assinaturas.listar(),
      repos.cartoes.listar(),
      repos.categorias.listar(),
      repos.terceiros.listar(),
      repos.receitas.listar(),
    ]).then(([assinaturas, cartoes, categorias, terceiros, receitas]) => {
      if (montado) setDados({ assinaturas, cartoes, categorias, terceiros, receitas });
    });
    return () => {
      montado = false;
    };
  }, [repos, versao]);

  if (!dados) return null;

  const formulario = {
    cartoes: dados.cartoes.filter((c) => c.ativo || c.id === editando?.cartaoId),
    categorias: dados.categorias.filter((c) => c.ativo || c.id === editando?.categoriaId),
    terceiros: dados.terceiros.filter(
      (t) => t.ativo || editando?.rateios.some((r) => r.terceiroId === t.id),
    ),
  };
  const renda = somar(
    receitasDoMes(dados.receitas, competenciaDe(hoje)).map((r) => r.valorCentavos),
  );
  const resumo = resumoDasAssinaturas(dados.assinaturas, renda);
  const proxima = dados.assinaturas
    .filter((a) => a.ativa)
    .map((a) => ({ assinatura: a, data: proximaCobranca(a, hoje) }))
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  const criar = async (nova: AssinaturaDoFormulario) => {
    await repos.assinaturas.criar({
      ...nova,
      ativa: true,
      inicio: inicioDaAssinatura(nova.dia, hoje),
    });
    setCriando(false);
    dadosMudaram();
    toast.success(`${nova.nome} adicionada. A cobrança entra sozinha todo mês.`);
  };

  const salvarEdicao = async (alterada: AssinaturaDoFormulario) => {
    if (!editando) return;
    const anterior = editando;
    await repos.assinaturas.atualizar(anterior.id, alterada);
    setEditando(null);
    dadosMudaram();
    toast.success('Assinatura atualizada. Vale a partir da próxima cobrança.', {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await repos.assinaturas.atualizar(anterior.id, anterior);
            dadosMudaram();
          }),
      },
    });
  };

  const excluir = async (assinatura: Assinatura) => {
    await repos.assinaturas.excluir(assinatura.id);
    setEditando(null);
    dadosMudaram();
    toast.success(`${assinatura.nome} excluída`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await repos.assinaturas.restaurar(assinatura.id);
            dadosMudaram();
          }),
      },
    });
  };

  const alternar = async (assinatura: Assinatura, ativa: boolean) => {
    const { inicio } = assinatura;
    const retomada = inicioDaAssinatura(assinatura.dia, hoje);
    await repos.assinaturas.atualizar(assinatura.id, {
      ativa,
      inicio: ativa && retomada > inicio ? retomada : inicio,
    });
    dadosMudaram();
    toast.success(ativa ? `${assinatura.nome} reativada` : `${assinatura.nome} pausada`, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await repos.assinaturas.atualizar(assinatura.id, { ativa: !ativa, inicio });
            dadosMudaram();
          }),
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          rotulo="Por mês"
          valor={formatarMoeda(resumo.porMes)}
          legenda={[
            resumo.ativas === 1 ? '1 ativa' : `${String(resumo.ativas)} ativas`,
            resumo.percentualDaRenda === null
              ? null
              : `${resumo.percentualDaRenda.toLocaleString('pt-BR')}% da renda`,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Kpi rotulo="Por ano" valor={formatarMoeda(resumo.porAno)} legenda="Se nada mudar" />
        <Kpi
          rotulo="Próxima cobrança"
          valor={proxima ? dataCurta(proxima.data) : '—'}
          legenda={
            proxima
              ? `${proxima.assinatura.nome} · ${formatarMoeda(proxima.assinatura.valorCentavos)}`
              : 'Nenhuma assinatura ativa'
          }
        />
      </div>

      <section
        aria-labelledby="lista-assinaturas"
        className="flex flex-col rounded-lg border bg-surface"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 id="lista-assinaturas" className="text-base font-semibold">
            Assinaturas
          </h2>
          <Button
            variant="outline"
            disabled={formulario.cartoes.length === 0}
            onClick={() => {
              setCriando(true);
            }}
          >
            <Plus strokeWidth={1.75} />
            Nova assinatura
          </Button>
        </div>

        {dados.assinaturas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-soft">
              <Repeat size={24} strokeWidth={1.75} aria-hidden className="text-ink-muted-on-tint" />
            </span>
            <p className="text-sm text-ink-muted">Nenhuma assinatura ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="h-10 border-y text-left text-xs text-ink-muted">
                <th scope="col" className="pl-6 font-medium">
                  Nome
                </th>
                <th scope="col" className="w-44 px-3 font-medium">
                  Cartão
                </th>
                <th scope="col" className="w-24 px-3 font-medium">
                  Cobra dia
                </th>
                <th scope="col" className="w-28 px-3 font-medium">
                  Próxima
                </th>
                <th scope="col" className="w-32 px-3 text-right font-medium">
                  Valor por mês
                </th>
                <th scope="col" className="w-20 pr-6 text-right font-medium">
                  Ativa
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.assinaturas.map((assinatura) => {
                const cartao = dados.cartoes.find((c) => c.id === assinatura.cartaoId);
                const quem = quemPaga(assinatura, dados.terceiros);
                return (
                  <tr key={assinatura.id} className="h-12 border-b last:border-b-0 hover:bg-soft">
                    <td className="pl-6">
                      <span className="flex items-center gap-3">
                        <span className="flex size-7 flex-none items-center justify-center rounded-md bg-brand-subtle text-brand-text">
                          <Repeat size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                        <button
                          type="button"
                          className="truncate text-left font-medium hover:underline"
                          onClick={() => {
                            setEditando(assinatura);
                          }}
                        >
                          {assinatura.nome}
                        </button>
                        {quem && (
                          <span className="rounded-full bg-info-bg px-2 text-xs leading-5 font-medium text-info-text">
                            {quem}
                          </span>
                        )}
                        {!assinatura.ativa && (
                          <span className="flex items-center gap-1 rounded-full bg-soft px-2 text-xs leading-5 font-medium text-ink-muted-on-tint">
                            <Pause size={12} strokeWidth={1.75} aria-hidden />
                            Pausada
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          style={{ backgroundColor: cartao?.cor }}
                          className="h-[11px] w-4 flex-none rounded-sm"
                        />
                        <span className="truncate">{cartao?.nome}</span>
                      </span>
                    </td>
                    <td className="px-3 tabular-nums">{assinatura.dia}</td>
                    <td className="px-3 text-ink-muted tabular-nums">
                      {assinatura.ativa ? dataCurta(proximaCobranca(assinatura, hoje)) : '—'}
                    </td>
                    <td className="px-3 text-right font-medium tabular-nums">
                      {formatarMoeda(assinatura.valorCentavos)}
                    </td>
                    <td className="pr-6 text-right">
                      <Switch
                        aria-label={`${assinatura.nome} ativa`}
                        checked={assinatura.ativa}
                        onCheckedChange={(ativa) =>
                          void executar(() => alternar(assinatura, ativa))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nova assinatura</DialogTitle>
            <DialogDescription>A cobrança entra sozinha na fatura todo mês.</DialogDescription>
          </DialogHeader>
          {criando && (
            <FormularioDeAssinatura
              dados={formulario}
              onSalvar={criar}
              rodape={
                <BotoesDoFormulario
                  onCancelar={() => {
                    setCriando(false);
                  }}
                />
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setEditando(null);
        }}
      >
        <SheetContent className="w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar assinatura</SheetTitle>
            <SheetDescription>
              Mudanças valem a partir da próxima cobrança; as já lançadas ficam como estão.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-6">
            {editando && (
              <FormularioDeAssinatura
                dados={formulario}
                inicial={editando}
                onSalvar={salvarEdicao}
                rodape={
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-danger-text"
                      onClick={() => void executar(() => excluir(editando))}
                    >
                      <Trash2 strokeWidth={1.75} />
                      Excluir
                    </Button>
                    <span className="flex-1" />
                    <BotoesDoFormulario
                      onCancelar={() => {
                        setEditando(null);
                      }}
                    />
                  </div>
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ rotulo, valor, legenda }: { rotulo: string; valor: string; legenda: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-6">
      <span className="text-sm text-ink-muted">{rotulo}</span>
      <span className="text-[28px] leading-[34px] font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-ink-muted">{legenda}</span>
    </div>
  );
}
