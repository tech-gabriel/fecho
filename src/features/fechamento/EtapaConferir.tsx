import { useId, useState } from 'react';
import { CircleCheck, FileSpreadsheet, Plus, TriangleAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import type { Conferencia } from '@/data';
import type { DataLocal } from '@/domain/competencia';
import { reconciliar, type LinhaDoBanco, type LinhaDoFecho } from '@/domain/reconciliacao';
import { executar } from '@/features/cadastros/SecaoCadastro';
import type { FaturaDoCartao } from '@/features/faturas/Faturas';
import { dataCurta } from '@/features/faturas/ListaDeCartoes';
import { formatarMoeda } from '@/lib/formato';
import { lerExtrato, type ExtratoLido } from './lerExtrato';

function linhasDoFecho(fatura: FaturaDoCartao): LinhaDoFecho[] {
  return fatura.parcelas.map((p) => ({
    id: String(p.parcelaId),
    compraId: p.compraId,
    data: p.dataCompra,
    descricao:
      p.numParcelas > 1
        ? `${p.descricao} ${String(p.numero)}/${String(p.numParcelas)}`
        : p.descricao,
    valor: p.valorCentavos,
    aVista: p.numParcelas === 1,
  }));
}

export function diferencasDaFatura(fatura: FaturaDoCartao, extrato: ExtratoLido | undefined) {
  if (!extrato) return null;
  const r = reconciliar(linhasDoFecho(fatura), extrato.linhas);
  return r.diferentes.length + r.soNoBanco.length + r.soNoFecho.length;
}

export function EtapaConferir({
  faturas,
  conferencias,
  extratos,
  onExtrato,
  hoje,
}: {
  faturas: FaturaDoCartao[];
  conferencias: Conferencia[];
  extratos: ReadonlyMap<number, ExtratoLido>;
  onExtrato: (cartaoId: number, extrato: ExtratoLido | null) => void;
  hoje: DataLocal;
}) {
  const [aba, setAba] = useState(faturas[0]?.cartao.id ?? 0);
  const fatura = faturas.find((f) => f.cartao.id === aba) ?? faturas[0];

  if (!fatura) {
    return (
      <p className="py-12 text-center text-sm text-ink-muted">
        Nenhuma fatura com compras neste mês. Pode seguir.
      </p>
    );
  }

  const conferida = (cartaoId: number) =>
    conferencias.find((c) => c.cartaoId === cartaoId && c.competencia === fatura.competencia);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Faturas para conferir" className="flex flex-wrap gap-2">
        {faturas.map((f) => {
          const diferencas = diferencasDaFatura(f, extratos.get(f.cartao.id));
          const ok = conferida(f.cartao.id) !== undefined;
          return (
            <button
              key={f.cartao.id}
              type="button"
              role="tab"
              aria-selected={f.cartao.id === fatura.cartao.id}
              onClick={() => {
                setAba(f.cartao.id);
              }}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md border px-3 text-sm',
                f.cartao.id === fatura.cartao.id
                  ? 'bg-brand-subtle font-semibold'
                  : 'hover:bg-soft',
              )}
            >
              <span
                aria-hidden
                style={{ backgroundColor: f.cartao.cor }}
                className="h-[11px] w-4 rounded-sm"
              />
              {f.cartao.nome}
              {ok ? (
                <CircleCheck
                  size={14}
                  strokeWidth={1.75}
                  aria-label="conferida"
                  className="text-success"
                />
              ) : (
                diferencas !== null &&
                diferencas > 0 && (
                  <span className="rounded-full bg-warning-bg px-1.5 text-xs text-warning-text">
                    {diferencas}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={fatura.cartao.nome}>
        {conferida(fatura.cartao.id) ? (
          <Conferida fatura={fatura} conferencia={conferida(fatura.cartao.id) as Conferencia} />
        ) : extratos.get(fatura.cartao.id) ? (
          <Comparacao
            fatura={fatura}
            extrato={extratos.get(fatura.cartao.id) as ExtratoLido}
            onTrocar={() => {
              onExtrato(fatura.cartao.id, null);
            }}
            hoje={hoje}
          />
        ) : (
          <SemExtrato
            fatura={fatura}
            onExtrato={(extrato) => {
              onExtrato(fatura.cartao.id, extrato);
            }}
            hoje={hoje}
          />
        )}
      </div>
    </div>
  );
}

function Conferida({ fatura, conferencia }: { fatura: FaturaDoCartao; conferencia: Conferencia }) {
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  return (
    <div className="flex items-center gap-3 rounded-md bg-success-bg px-4 py-3 text-sm text-success-text">
      <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="flex-none" />
      <span className="flex-1">
        Fatura do {fatura.cartao.nome} conferida em {dataCurta(conferencia.conferidaEm)}
        {conferencia.extrato ? ` com ${conferencia.extrato}` : ' sem extrato'}.
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          void executar(async () => {
            await repos.fechamento.desconferir(fatura.cartao.id, fatura.competencia);
            dadosMudaram();
          })
        }
      >
        Conferir de novo
      </Button>
    </div>
  );
}

function SemExtrato({
  fatura,
  onExtrato,
  hoje,
}: {
  fatura: FaturaDoCartao;
  onExtrato: (extrato: ExtratoLido) => void;
  hoje: DataLocal;
}) {
  const id = useId();
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const ler = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      onExtrato(await lerExtrato(arquivo));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ler esse arquivo.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setArrastando(true);
        }}
        onDragLeave={() => {
          setArrastando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setArrastando(false);
          void ler(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-[10px] border-2 border-dashed px-6 py-8 text-center',
          erro ? 'border-danger' : 'border-border-strong',
          arrastando && 'bg-brand-subtle',
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-soft">
          <Upload size={24} strokeWidth={1.75} aria-hidden />
        </span>
        <p className="text-sm">
          Solte aqui a fatura do {fatura.cartao.nome} em .csv ou .xlsx, baixada no app do banco.
        </p>
        <label htmlFor={`${id}-arquivo`}>
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-soft has-[:focus-visible]:outline-2">
            <FileSpreadsheet size={16} strokeWidth={1.75} aria-hidden />
            Escolher arquivo
          </span>
          <input
            id={`${id}-arquivo`}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(e) => void ler(e.target.files?.[0])}
          />
        </label>
        {erro && (
          <p role="alert" className="text-sm text-danger-text">
            {erro}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 text-[13px] text-ink-muted">
        <span>O banco só dá PDF? Confira o total à mão e siga.</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void executar(async () => {
              await repos.fechamento.conferir({
                cartaoId: fatura.cartao.id,
                competencia: fatura.competencia,
                extrato: null,
                conferidaEm: hoje,
              });
              dadosMudaram();
            })
          }
        >
          Conferir sem extrato
        </Button>
      </div>
    </div>
  );
}

function Comparacao({
  fatura,
  extrato,
  onTrocar,
  hoje,
}: {
  fatura: FaturaDoCartao;
  extrato: ExtratoLido;
  onTrocar: () => void;
  hoje: DataLocal;
}) {
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const r = reconciliar(linhasDoFecho(fatura), extrato.linhas);
  const diferencas = r.diferentes.length + r.soNoBanco.length + r.soNoFecho.length;

  const comDesfazer = (mensagem: string, desfazer: () => Promise<void>) => {
    dadosMudaram();
    toast.success(mensagem, {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await desfazer();
            dadosMudaram();
          }),
      },
    });
  };

  const usarValorDoBanco = (compraId: number, valor: number) =>
    executar(async () => {
      const anterior = await repos.compras.buscar(compraId);
      await repos.compras.substituir(compraId, { ...anterior, valorTotal: valor });
      comDesfazer(`Valor atualizado para ${formatarMoeda(valor)}`, () =>
        repos.compras.substituir(compraId, anterior),
      );
    });

  const adicionar = (linha: LinhaDoBanco) =>
    executar(async () => {
      const id = await repos.compras.salvar({
        cartaoId: fatura.cartao.id,
        descricao: linha.descricao,
        categoriaId: null,
        valorTotal: linha.valor,
        numParcelas: 1,
        dataCompra: linha.data,
        recorrente: false,
        rateios: [],
      });
      comDesfazer(`${linha.descricao} adicionada`, () => repos.compras.excluir(id));
    });

  const linha = (conteudo: React.ReactNode, aviso: boolean, chave: string) => (
    <li
      key={chave}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-center gap-2 border-t px-3 py-2 text-[13px]',
        aviso && 'bg-warning-bg',
      )}
    >
      {conteudo}
    </li>
  );
  const lado = (l: { data: string; descricao: string; valor: number } | null, banco = false) =>
    l ? (
      <span className="flex min-w-0 items-center gap-2">
        <span className="w-10 flex-none text-ink-muted tabular-nums">{dataCurta(l.data)}</span>
        <span className={cn('min-w-0 flex-1 truncate', banco && 'text-xs uppercase')}>
          {l.descricao}
        </span>
        <span className="font-medium tabular-nums">{formatarMoeda(l.valor)}</span>
      </span>
    ) : (
      <span className="text-ink-muted">Não está no extrato</span>
    );
  const icone = (ok: boolean) =>
    ok ? (
      <CircleCheck
        size={16}
        strokeWidth={1.75}
        aria-label="confere"
        className="mx-auto text-success"
      />
    ) : (
      <TriangleAlert
        size={16}
        strokeWidth={1.75}
        aria-label="diferente"
        className="mx-auto text-warning"
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <FileSpreadsheet size={16} strokeWidth={1.75} aria-hidden />
        <span className="flex-1">{extrato.nome} · importado agora</span>
        <Button variant="ghost" size="sm" onClick={onTrocar}>
          Trocar extrato
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col rounded-md border p-4">
          <span className="text-xs text-ink-muted">No Fechô</span>
          <span className="text-xl leading-7 font-bold tabular-nums">
            {formatarMoeda(r.totalFecho)}
          </span>
        </div>
        <div className="flex flex-col rounded-md border p-4">
          <span className="text-xs text-ink-muted">No extrato do banco</span>
          <span className="text-xl leading-7 font-bold tabular-nums">
            {formatarMoeda(r.totalBanco)}
          </span>
        </div>
      </div>
      <p
        role="status"
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-[13px]',
          diferencas === 0 ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text',
        )}
      >
        {diferencas === 0 ? (
          <>
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
            Bateu! O Fechô e o extrato do banco mostram o mesmo total.
          </>
        ) : (
          <>
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
            {diferencas === 1 ? '1 diferença' : `${String(diferencas)} diferenças`} entre o Fechô e
            o extrato. Resolva abaixo ou marque como conferida assim mesmo.
          </>
        )}
      </p>
      <ul aria-label="Fechô e extrato lado a lado" className="flex flex-col rounded-md border">
        <li className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] gap-2 px-3 py-2 text-xs text-ink-muted">
          <span>No Fechô</span>
          <span />
          <span>No extrato</span>
        </li>
        {r.iguais.map(({ fecho, banco }) =>
          linha(
            <>
              {lado(fecho)}
              {icone(true)}
              {lado(banco, true)}
            </>,
            false,
            fecho.id,
          ),
        )}
        {r.diferentes.map(({ fecho, banco }) =>
          linha(
            <>
              {lado(fecho)}
              {icone(false)}
              <span className="flex min-w-0 flex-col gap-1">
                {lado(banco, true)}
                {fecho.aVista && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 self-end bg-surface"
                    onClick={() => void usarValorDoBanco(fecho.compraId, banco.valor)}
                  >
                    Usar valor do banco
                  </Button>
                )}
              </span>
            </>,
            true,
            fecho.id,
          ),
        )}
        {r.soNoFecho.map((fecho) =>
          linha(
            <>
              {lado(fecho)}
              {icone(false)}
              {lado(null)}
            </>,
            true,
            fecho.id,
          ),
        )}
        {r.soNoBanco.map((banco, i) =>
          linha(
            <>
              <span className="text-ink-muted">Não está no Fechô</span>
              {icone(false)}
              <span className="flex min-w-0 flex-col gap-1">
                {lado(banco, true)}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 self-end bg-surface"
                  onClick={() => void adicionar(banco)}
                >
                  <Plus strokeWidth={1.75} />
                  Adicionar ao Fechô
                </Button>
              </span>
            </>,
            true,
            `banco-${String(i)}`,
          ),
        )}
      </ul>
      <Button
        variant="outline"
        className="self-end"
        onClick={() =>
          void executar(async () => {
            await repos.fechamento.conferir({
              cartaoId: fatura.cartao.id,
              competencia: fatura.competencia,
              extrato: extrato.nome,
              conferidaEm: hoje,
            });
            dadosMudaram();
          })
        }
      >
        <CircleCheck strokeWidth={1.75} />
        Marcar como conferida
      </Button>
    </div>
  );
}
