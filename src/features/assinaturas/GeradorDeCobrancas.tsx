import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { hojeLocal, useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Cartao, Repositorios } from '@/data';
import {
  type Cobranca,
  chaveDaCobranca,
  cobrancasAGerar,
  compraDaCobranca,
} from '@/domain/assinaturas';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';

const UMA_HORA = 60 * 60 * 1000;

async function gravar(repos: Repositorios, cobrancas: readonly Cobranca[]) {
  const falharam: Cobranca[] = [];
  for (const cobranca of cobrancas) {
    try {
      await repos.compras.salvar(compraDaCobranca(cobranca));
    } catch {
      falharam.push(cobranca);
    }
  }
  if (falharam.length > 0) {
    const nomes = [...new Set(falharam.map((c) => c.assinatura.nome))];
    toast.error(`Não foi possível gerar a cobrança de ${nomes.join(', ')}.`);
  }
  return { salvas: cobrancas.length - falharam.length, falharam };
}

const chave = (c: Cobranca) => chaveDaCobranca(c.assinatura.id, c.mes);

export function GeradorDeCobrancas() {
  const repos = useRepositorios();
  const versao = useApp((s) => s.versaoDosDados);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [hoje, setHoje] = useState(hojeLocal);
  const [atrasadas, setAtrasadas] = useState<Cobranca[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [adiadas, setAdiadas] = useState(false);
  const rodando = useRef(false);
  // o que falhou não é tentado de novo nesta sessão, para não repetir o aviso a cada mudança
  const falhas = useRef(new Set<string>());

  useEffect(() => {
    const relogio = setInterval(() => {
      setHoje(hojeLocal());
    }, UMA_HORA);
    return () => {
      clearInterval(relogio);
    };
  }, []);

  useEffect(() => {
    if (rodando.current) return;
    rodando.current = true;
    void (async () => {
      try {
        const [assinaturas, geradas, listaDeCartoes] = await Promise.all([
          repos.assinaturas.listar(),
          repos.assinaturas.geradas(),
          repos.cartoes.listar(),
        ]);
        const pendentes = cobrancasAGerar(assinaturas, new Set(geradas), hoje);
        setCartoes(listaDeCartoes);
        setAtrasadas(pendentes.atrasadas);
        const doMes = pendentes.doMes.filter((c) => !falhas.current.has(chave(c)));
        if (doMes.length > 0) {
          const { salvas, falharam } = await gravar(repos, doMes);
          for (const c of falharam) falhas.current.add(chave(c));
          if (salvas > 0) dadosMudaram();
        }
      } finally {
        rodando.current = false;
      }
    })();
  }, [repos, versao, hoje, dadosMudaram]);

  const gerarAtrasadas = async () => {
    const lista = atrasadas;
    setAtrasadas([]);
    const { salvas } = await gravar(repos, lista);
    if (salvas === 0) return;
    toast.success(salvas === 1 ? '1 cobrança gerada' : `${String(salvas)} cobranças geradas`);
    dadosMudaram();
  };

  const meses = [...new Set(atrasadas.map((c) => c.mes))];
  const nomeDoCartao = (id: number) => cartoes.find((c) => c.id === id)?.nome ?? '';

  return (
    <Dialog
      open={atrasadas.length > 0 && !adiadas}
      onOpenChange={(aberto) => {
        if (!aberto) setAdiadas(true);
      }}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Cobranças que ficaram para trás</DialogTitle>
          <DialogDescription>
            O Fechô ficou fechado e estas assinaturas não entraram nas faturas. Gerar agora?
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
          {meses.map((mes) => (
            <section key={mes} aria-label={nomeDoMes(mes)} className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-ink-muted">{nomeDoMes(mes)}</h3>
              <ul className="flex flex-col">
                {atrasadas
                  .filter((c) => c.mes === mes)
                  .map(({ assinatura }) => (
                    <li
                      key={assinatura.id}
                      className="flex items-center gap-3 border-t py-2 text-sm first:border-t-0"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{assinatura.nome}</span>
                      <span className="text-ink-muted">{nomeDoCartao(assinatura.cartaoId)}</span>
                      <span className="w-24 text-right tabular-nums">
                        {formatarMoeda(assinatura.valorCentavos)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setAdiadas(true);
            }}
          >
            Agora não
          </Button>
          <Button onClick={() => void gerarAtrasadas()}>
            {atrasadas.length === 1
              ? 'Gerar 1 cobrança'
              : `Gerar ${String(atrasadas.length)} cobranças`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
