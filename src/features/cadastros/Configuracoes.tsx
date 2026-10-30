import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowRight, CreditCard, Shapes, UsersRound } from 'lucide-react';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Cartao, Novo } from '@/data';
import { recalcularFechamento, type MudancaDeFatura } from '@/domain/faturas';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';
import { FormCartao, FormCategoria, FormPessoa } from './formularios';
import { iconeDaCategoria } from './opcoes';
import { executar, SecaoCadastro } from './SecaoCadastro';
import { SecaoAlertas } from './SecaoAlertas';
import { SecaoAparencia } from './SecaoAparencia';
import { SecaoAtalhos } from './SecaoAtalhos';
import { SecaoBackup } from './SecaoBackup';
import { SecaoSeguranca } from './SecaoSeguranca';
import { SecaoSobre } from './SecaoSobre';
import { SecaoCobranca } from './SecaoCobranca';
import { SecaoPlanejamento } from './SecaoPlanejamento';

const SECOES = [
  { ancora: 'cartoes', rotulo: 'Cartões' },
  { ancora: 'pessoas', rotulo: 'Pessoas' },
  { ancora: 'categorias', rotulo: 'Categorias' },
  { ancora: 'aparencia', rotulo: 'Aparência' },
  { ancora: 'planejamento', rotulo: 'Planejamento' },
  { ancora: 'seguranca', rotulo: 'Segurança' },
  { ancora: 'alertas', rotulo: 'Alertas' },
  { ancora: 'cobranca', rotulo: 'Cobrança' },
  { ancora: 'dados', rotulo: 'Dados e backup' },
  { ancora: 'atalhos', rotulo: 'Atalhos' },
  { ancora: 'sobre', rotulo: 'Sobre' },
];

const dia = (n: number) => `Dia ${String(n).padStart(2, '0')}`;

interface Previa {
  item: Cartao;
  dados: Novo<Cartao>;
  mudancas: MudancaDeFatura[];
  concluir: () => void;
}

export function Configuracoes() {
  const repos = useRepositorios();
  const [previa, setPrevia] = useState<Previa | null>(null);

  const [busca] = useSearchParams();
  const secaoPedida = busca.get('secao');

  const irPara = (ancora: string) => {
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(ancora)?.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    const alvo = secaoPedida && document.getElementById(secaoPedida);
    const conteudo = alvo && alvo.parentElement;
    if (!alvo || !conteudo) return;
    alvo.scrollIntoView();
    // as seções de cima carregam depois e empurram o alvo; reposiciona até o usuário rolar
    const observador = new ResizeObserver(() => {
      alvo.scrollIntoView();
    });
    [...conteudo.children].forEach((filho) => {
      observador.observe(filho);
    });
    const parar = () => {
      observador.disconnect();
    };
    const prazo = setTimeout(parar, 1000);
    conteudo.addEventListener('wheel', parar, { once: true });
    window.addEventListener('keydown', parar, { once: true });
    return () => {
      clearTimeout(prazo);
      parar();
      conteudo.removeEventListener('wheel', parar);
      window.removeEventListener('keydown', parar);
    };
  }, [secaoPedida]);

  const salvarCartao = async (item: Cartao, dados: Novo<Cartao>, concluir: () => void) => {
    const mudancas =
      dados.diaFechamento === item.diaFechamento
        ? []
        : recalcularFechamento(
            await repos.cartoes.comprasParaRecalculo(item.id),
            item.diaFechamento,
            dados.diaFechamento,
            hojeLocal(),
            (await repos.faturas.pagamentos())
              .filter((p) => p.cartaoId === item.id)
              .map((p) => p.competencia),
          );
    if (mudancas.length > 0) {
      setPrevia({ item, dados, mudancas, concluir });
      return;
    }
    await repos.cartoes.atualizarComParcelas(item.id, dados, []);
    concluir();
  };

  const confirmarPrevia = ({ item, dados, mudancas, concluir }: Previa) =>
    executar(async () => {
      await repos.cartoes.atualizarComParcelas(item.id, dados, mudancas);
      setPrevia(null);
      concluir();
    });

  const quantas = previa?.mudancas.length ?? 0;
  const compras = quantas === 1 ? '1 compra' : `${quantas} compras`;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)] gap-6">
      <nav aria-label="Seções das configurações" className="flex flex-col gap-0.5">
        {SECOES.map((secao) => (
          <button
            key={secao.ancora}
            type="button"
            onClick={() => {
              irPara(secao.ancora);
            }}
            className="flex h-9 items-center rounded-md px-3 text-left text-sm hover:bg-soft"
          >
            {secao.rotulo}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-6">
        <SecaoCadastro<Cartao>
          ancora="cartoes"
          titulo="Cartões"
          singular="Cartão"
          feminino={false}
          repo={repos.cartoes}
          icone={CreditCard}
          vazio="Você ainda não cadastrou nenhum cartão."
          marcador={(c) => (
            <span
              aria-hidden
              style={{ backgroundColor: c.cor }}
              className="h-[11px] w-4 flex-none rounded-sm"
            />
          )}
          colunas={[
            {
              cabecalho: 'Banco',
              largura: '208px',
              celula: (c) =>
                [c.banco, c.final && `final ${c.final}`].filter(Boolean).join(' · ') || '—',
            },
            { cabecalho: 'Fecha dia', largura: '96px', celula: (c) => dia(c.diaFechamento) },
            { cabecalho: 'Vence dia', largura: '96px', celula: (c) => dia(c.diaVencimento) },
            {
              cabecalho: 'Limite',
              largura: '128px',
              direita: true,
              celula: (c) => formatarMoeda(c.limiteCentavos),
            },
          ]}
          Formulario={FormCartao}
          salvarEdicao={salvarCartao}
        />

        <SecaoCadastro
          ancora="pessoas"
          titulo="Pessoas"
          singular="Pessoa"
          feminino
          repo={repos.terceiros}
          icone={UsersRound}
          vazio="Ninguém usa o seu cartão por enquanto."
          marcador={(p) => (
            <span
              aria-hidden
              className="flex size-6 flex-none items-center justify-center rounded-full bg-info-bg text-xs font-semibold text-info-text"
            >
              {p.nome.charAt(0).toUpperCase()}
            </span>
          )}
          colunas={[]}
          Formulario={FormPessoa}
        />

        <SecaoCadastro
          ancora="categorias"
          titulo="Categorias"
          singular="Categoria"
          feminino
          repo={repos.categorias}
          icone={Shapes}
          vazio="Nenhuma categoria cadastrada."
          marcador={(c) => {
            const Icone = iconeDaCategoria(c.icone);
            return (
              <Icone
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="flex-none text-ink-muted"
              />
            );
          }}
          colunas={[
            {
              cabecalho: 'Limite por mês',
              largura: '144px',
              direita: true,
              celula: (c) => (c.limiteCentavos ? formatarMoeda(c.limiteCentavos) : '—'),
            },
          ]}
          Formulario={FormCategoria}
        />

        <SecaoAparencia />
        <SecaoPlanejamento />
        <SecaoSeguranca />
        <SecaoAlertas />
        <SecaoCobranca />
        <SecaoBackup />
        <SecaoAtalhos />
        <SecaoSobre />
      </div>

      <Dialog
        open={previa !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPrevia(null);
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {quantas === 1 ? '1 compra muda de fatura' : `${compras} mudam de fatura`}
            </DialogTitle>
            <DialogDescription>
              Com o fechamento no dia {previa?.dados.diaFechamento}, estas compras passam para outra
              fatura. As parcelas seguintes acompanham.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-64 flex-col overflow-y-auto rounded-md border">
            {previa?.mudancas.map((m) => (
              <li
                key={m.compraId}
                className="flex h-10 items-center gap-3 border-t px-3 text-[13px] first:border-t-0"
              >
                <span className="flex-1 truncate font-medium">{m.descricao}</span>
                <span className="text-ink-muted">{nomeDoMes(m.de)}</span>
                <ArrowRight size={16} strokeWidth={1.75} aria-label="para" />
                <span className="font-medium">{nomeDoMes(m.para)}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPrevia(null);
              }}
            >
              Voltar
            </Button>
            <Button onClick={() => previa && void confirmarPrevia(previa)}>
              Salvar e mover {compras}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
