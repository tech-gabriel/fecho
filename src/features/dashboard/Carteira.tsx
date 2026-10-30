import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { CartaoDesenhado } from '@/components/CartaoDesenhado';
import { Button } from '@/components/ui/button';
import type { Preferencias, Terceiro } from '@/data';
import type { DataLocal } from '@/domain/competencia';
import { executar } from '@/features/cadastros/SecaoCadastro';
import type { FaturaDoCartao } from '@/features/faturas/Faturas';
import { dataCurta, SeloDeStatus } from '@/features/faturas/ListaDeCartoes';
import { useAcoesDeCobranca } from '@/features/receber/acoes';
import { faltaNaFatura, type SituacaoDaPessoa } from '@/features/receber/situacoes';
import { formatarMoeda } from '@/lib/formato';
import { DURACAO, Flip, MOVIMENTO, gsap, reduzirMovimento, useGSAP } from '@/lib/gsap';

function textoDoSelo(fatura: FaturaDoCartao, hoje: DataLocal) {
  if (fatura.pagamento) return `Paga em ${dataCurta(fatura.pagamento.pagoEm)}`;
  if (fatura.status === 'atrasada') {
    const dias = Math.round(
      (Date.parse(hoje) - Date.parse(fatura.vencimento)) / (24 * 60 * 60 * 1000),
    );
    return `Atrasada · ${String(dias)} ${dias === 1 ? 'dia' : 'dias'}`;
  }
  return `Vence ${dataCurta(fatura.vencimento)}`;
}

function FaturaNaCarteira({
  fatura,
  terceiros,
  situacoes,
  preferencias,
  hoje,
  onMudou,
}: {
  fatura: FaturaDoCartao;
  terceiros: Terceiro[];
  situacoes: SituacaoDaPessoa[];
  preferencias: Preferencias;
  hoje: DataLocal;
  onMudou: () => void;
}) {
  const repos = useRepositorios();
  const { copiarCobranca } = useAcoesDeCobranca(preferencias, hoje);
  const { cartao, resumo, competencia } = fatura;
  const partes = [...resumo.porTerceiro].flatMap(([id, valor]) => {
    const terceiro = terceiros.find((t) => t.id === id);
    return terceiro && valor > 0 ? [{ terceiro, valor }] : [];
  });
  const devedor = fatura.pagamento
    ? undefined
    : faltaNaFatura(situacoes, cartao.id, competencia)[0];

  const desmarcar = () =>
    executar(async () => {
      await repos.faturas.desmarcar(cartao.id, competencia);
      onMudou();
    });

  const marcarPaga = () =>
    executar(async () => {
      await repos.faturas.marcarComoPaga({
        cartaoId: cartao.id,
        competencia,
        pagoEm: hoje,
        valorPagoCentavos: resumo.total,
      });
      onMudou();
      toast.success(`Fatura do ${cartao.nome} marcada como paga`, {
        action: { label: 'Desfazer', onClick: () => void desmarcar() },
      });
    });

  return (
    <li
      aria-label={cartao.nome}
      data-flip-id={cartao.id}
      className="item-da-carteira flex w-[calc((100cqw-2.5rem)/2.2)] shrink-0 grow snap-start flex-col gap-3 @[880px]:w-[calc((100cqw-3.75rem)/3.2)] @[1240px]:w-[calc((100cqw-5rem)/4.2)]"
    >
      <CartaoDesenhado cartao={cartao} tamanho="g" className="w-full" />
      <div
        className={
          fatura.status === 'atrasada'
            ? 'flex flex-col gap-2.5 rounded-lg border border-danger/40 bg-surface p-4'
            : 'flex flex-col gap-2.5 rounded-lg border bg-surface p-4'
        }
      >
        <div className="flex items-center justify-between gap-2">
          <Link
            to={`/faturas?cartao=${String(cartao.id)}`}
            aria-label={`Ver fatura do ${cartao.nome}: ${formatarMoeda(resumo.total)}`}
            className="text-[22px] leading-7 font-bold tracking-[-0.01em] tabular-nums hover:text-brand-text hover:underline"
          >
            {formatarMoeda(resumo.total)}
          </Link>
          <SeloDeStatus status={fatura.status} texto={textoDoSelo(fatura, hoje)} />
        </div>
        <div
          role="img"
          aria-label={
            partes.length === 0
              ? 'Tudo seu'
              : `${formatarMoeda(resumo.meu)} seus, ${partes
                  .map((p) => `${formatarMoeda(p.valor)} de ${p.terceiro.nome}`)
                  .join(', ')}`
          }
          className="barra-da-fatura flex h-2 gap-0.5 overflow-hidden rounded-full"
        >
          {resumo.meu > 0 && <span className="bg-brand" style={{ flexGrow: resumo.meu }} />}
          {partes.map((p) => (
            <span
              key={p.terceiro.id}
              className="bg-[repeating-linear-gradient(135deg,var(--color-brand)_0_2px,var(--color-brand-subtle)_2px_5px)]"
              style={{ flexGrow: p.valor }}
            />
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px]">
          {partes.length === 0 ? (
            <span>Tudo seu</span>
          ) : (
            <>
              <span className="text-brand-text">
                Seu <b className="tabular-nums">{formatarMoeda(resumo.meu)}</b>
              </span>
              {partes.map((p) => (
                <span key={p.terceiro.id} className="text-ink-muted">
                  {p.terceiro.nome} <b className="tabular-nums">{formatarMoeda(p.valor)}</b>
                </span>
              ))}
            </>
          )}
        </div>
        {(!fatura.pagamento || devedor) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {!fatura.pagamento && (
              <Button
                size="sm"
                variant={fatura.status === 'atrasada' ? 'default' : 'ghost'}
                onClick={() => void marcarPaga()}
              >
                Marcar paga
              </Button>
            )}
            {devedor && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void copiarCobranca(
                    devedor.terceiro,
                    { valor: devedor.falta, cartao: cartao.nome, vencimento: fatura.vencimento },
                    () => undefined,
                  )
                }
              >
                Cobrar {devedor.terceiro.nome}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function Carteira({
  mes,
  faturas,
  semFatura,
  terceiros,
  situacoes,
  preferencias,
  hoje,
  onMudou,
  onRegistrar,
}: {
  mes: string;
  faturas: FaturaDoCartao[];
  semFatura: string[];
  terceiros: Terceiro[];
  situacoes: SituacaoDaPessoa[];
  preferencias: Preferencias;
  hoje: DataLocal;
  onMudou: () => void;
  onRegistrar: () => void;
}) {
  const faixa = useRef<HTMLUListElement>(null);
  const secao = useRef<HTMLElement>(null);
  const estadoAnterior = useRef<Flip.FlipState | null>(null);
  const medirRef = useRef<() => void>(() => undefined);
  const ordem = faturas.map((f) => `${String(f.cartao.id)}:${f.status}`).join('|');

  // fromTo com valor final explícito: no StrictMode o efeito roda duas vezes e um from leria a barra no meio
  useGSAP(
    () => {
      gsap.matchMedia().add(MOVIMENTO, (contexto) => {
        const { reduzido } = contexto.conditions as { reduzido: boolean };
        if (reduzido) {
          gsap.fromTo(
            '.item-da-carteira',
            { opacity: 0 },
            { opacity: 1, duration: DURACAO.micro, clearProps: 'opacity' },
          );
          return;
        }
        gsap.fromTo(
          '.item-da-carteira',
          { x: 24, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: DURACAO.componente,
            stagger: 0.06,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            onComplete: () => {
              medirRef.current();
            },
          },
        );
        gsap.fromTo(
          '.barra-da-fatura > span',
          { scaleX: 0, transformOrigin: 'left center' },
          {
            scaleX: 1,
            duration: DURACAO.pagina,
            delay: 0.1,
            stagger: 0.04,
            ease: 'power2.out',
            clearProps: 'transform',
          },
        );
      });
    },
    { scope: secao },
  );

  // quando uma fatura muda de grupo (paga, atrasa), os cartões deslizam para o novo lugar
  useLayoutEffect(() => {
    const itens = secao.current?.querySelectorAll('.item-da-carteira');
    if (!itens?.length) return;
    if (estadoAnterior.current && !reduzirMovimento()) {
      Flip.from(estadoAnterior.current, {
        targets: itens,
        duration: DURACAO.pagina,
        ease: 'power2.out',
      });
    }
    estadoAnterior.current = Flip.getState(itens);
  }, [ordem]);
  const [pontas, setPontas] = useState({ inicio: true, fim: true });

  const medir = () => {
    const el = faixa.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setPontas({ inicio: scrollLeft <= 1, fim: scrollLeft + clientWidth >= scrollWidth - 1 });
  };
  useLayoutEffect(() => {
    medirRef.current = medir;
  });

  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    // a sidebar recolhendo muda a largura sem disparar resize na janela
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      observador.disconnect();
    };
  }, [faturas.length]);

  const rolar = (sentido: 1 | -1) => {
    faixa.current?.scrollBy({
      left: sentido * 360,
      behavior: reduzirMovimento() ? 'auto' : 'smooth',
    });
  };

  return (
    <section
      ref={secao}
      aria-labelledby="carteira"
      className="@container flex min-w-0 flex-col gap-3.5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="carteira" className="text-base font-semibold">
          Faturas de {mes}
          <span className="font-medium text-ink-muted">
            {' '}
            · {faturas.length} {faturas.length === 1 ? 'cartão' : 'cartões'}
          </span>
        </h2>
        {!(pontas.inicio && pontas.fim) && (
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Cartões anteriores"
              disabled={pontas.inicio}
              onClick={() => {
                rolar(-1);
              }}
            >
              <ChevronLeft strokeWidth={1.75} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximos cartões"
              disabled={pontas.fim}
              onClick={() => {
                rolar(1);
              }}
            >
              <ChevronRight strokeWidth={1.75} />
            </Button>
          </div>
        )}
      </div>
      {faturas.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-ink-muted">
          Nenhuma fatura em {mes}.
        </p>
      ) : (
        <ul
          ref={faixa}
          aria-label="Faturas por cartão"
          onScroll={medir}
          className="flex snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:var(--color-brand)_transparent] gap-5 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring)"
        >
          {faturas.map((fatura) => (
            <FaturaNaCarteira
              key={fatura.cartao.id}
              fatura={fatura}
              terceiros={terceiros}
              situacoes={situacoes}
              preferencias={preferencias}
              hoje={hoje}
              onMudou={onMudou}
            />
          ))}
        </ul>
      )}
      {semFatura.length > 0 && (
        <p className="text-[13px] text-ink-muted">
          Sem fatura em {mes}: {semFatura.join(', ')} ·{' '}
          <button
            type="button"
            onClick={onRegistrar}
            className="font-medium text-brand-text hover:underline"
          >
            Registrar compra
          </button>
        </p>
      )}
    </section>
  );
}
