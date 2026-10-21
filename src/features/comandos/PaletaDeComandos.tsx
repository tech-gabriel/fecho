import { useEffect, useState, type ReactNode } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import {
  FileSpreadsheet,
  FileUp,
  HandCoins,
  Keyboard,
  Lock,
  Plus,
  Receipt,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { Kbd } from '@/app/layout/apoio';
import { CONFIGURACOES, PAGINAS } from '@/app/paginas';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { registrarDeposito } from '@/app/useAtalhosGlobais';
import { usePedirBloqueio } from '@/app/useBloqueio';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { buscarCompras, type CompraBuscavel } from '@/domain/busca';
import { normalizar } from '@/domain/importacao';
import { useExportarPlanilha } from '@/features/exportacao/useExportarPlanilha';
import { formatarMoeda, nomeDoMes } from '@/lib/formato';

interface Comando {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  teclas?: string;
  executar: () => void;
}

const dataLonga = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

function Item({
  valor,
  icone: Icone,
  teclas,
  children,
  onSelect,
}: {
  valor: string;
  icone: LucideIcon;
  teclas?: string | undefined;
  children: ReactNode;
  onSelect: () => void;
}) {
  return (
    <CommandPrimitive.Item
      value={valor}
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-[selected=true]:bg-soft"
    >
      <Icone size={16} strokeWidth={1.75} aria-hidden className="flex-none text-ink-muted" />
      {children}
      {teclas && <Kbd className="ml-auto bg-soft">{teclas.replace(/\+/g, ' ')}</Kbd>}
    </CommandPrimitive.Item>
  );
}

const CLASSE_DO_GRUPO =
  'px-2 pb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-muted';

export function PaletaDeComandos() {
  const aberta = useApp((s) => s.overlay === 'paleta');
  const abrirOverlay = useApp((s) => s.abrirOverlay);
  const competencia = useApp((s) => s.competencia);
  const abrirNovaCompra = useApp((s) => s.abrirNovaCompra);
  const editarCompra = useApp((s) => s.editarCompra);
  const repos = useRepositorios();
  const navigate = useNavigate();
  const pedirBloqueio = usePedirBloqueio();
  const exportarPlanilha = useExportarPlanilha();
  const [termo, setTermo] = useState('');
  const [compras, setCompras] = useState<CompraBuscavel[]>([]);

  useEffect(() => {
    if (!aberta) return;
    let montado = true;
    void repos.compras.listar().then((lista) => {
      if (montado) setCompras(lista);
    });
    return () => {
      montado = false;
      setTermo('');
    };
  }, [aberta, repos]);

  const fechar = () => {
    abrirOverlay(null);
  };
  const ir = (caminho: string) => () => void navigate(caminho);
  const mes = nomeDoMes(competencia).split(' ')[0] ?? '';

  const acoes: Comando[] = [
    {
      id: 'nova',
      rotulo: 'Nova compra',
      icone: Plus,
      teclas: 'Ctrl+N',
      executar: () => {
        abrirNovaCompra();
      },
    },
    {
      id: 'deposito',
      rotulo: 'Registrar depósito de terceiro',
      icone: HandCoins,
      teclas: 'Ctrl+R',
      executar: () => {
        registrarDeposito(navigate);
      },
    },
    { id: 'fechar', rotulo: `Fechar ${mes}`, icone: Lock, executar: ir(`/fechar/${competencia}`) },
    { id: 'importar', rotulo: 'Importar planilha', icone: FileUp, executar: ir('/importar') },
    {
      id: 'exportar',
      rotulo: 'Exportar planilha do mês',
      icone: FileSpreadsheet,
      executar: () => void exportarPlanilha(),
    },
    { id: 'bloquear', rotulo: 'Bloquear', icone: Lock, teclas: 'Ctrl+L', executar: pedirBloqueio },
    {
      id: 'atalhos',
      rotulo: 'Ver atalhos',
      icone: Keyboard,
      teclas: '?',
      executar: () => {
        abrirOverlay('atalhos');
      },
    },
  ];
  const telas: Comando[] = [
    ...PAGINAS.map((p, i) => ({
      id: p.caminho,
      rotulo: p.rotulo,
      icone: p.icone,
      teclas: `Ctrl+${String(i + 1)}`,
      executar: ir(p.caminho),
    })),
    {
      id: CONFIGURACOES.caminho,
      rotulo: CONFIGURACOES.rotulo,
      icone: CONFIGURACOES.icone,
      teclas: 'Ctrl+,',
      executar: ir(CONFIGURACOES.caminho),
    },
  ];

  const filtro = normalizar(termo);
  const filtrar = (lista: Comando[]) => lista.filter((c) => normalizar(c.rotulo).includes(filtro));
  const grupos: [string, Comando[]][] = [
    ['Ações', filtrar(acoes)],
    ['Ir para', filtrar(telas)],
  ];
  const achadas = buscarCompras(compras, termo);

  const rodar = (executar: () => void) => () => {
    fechar();
    executar();
  };

  return (
    <Dialog
      open={aberta}
      onOpenChange={(abrir) => {
        abrirOverlay(abrir ? 'paleta' : null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-24 flex max-w-[640px] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">Comandos</DialogTitle>
        <DialogDescription className="sr-only">
          Busque uma ação, uma tela ou uma compra.
        </DialogDescription>
        <CommandPrimitive shouldFilter={false} loop className="flex flex-col" label="Comandos">
          <div className="flex h-[52px] items-center gap-3 border-b px-4">
            <Search size={20} strokeWidth={1.75} aria-hidden className="text-ink-muted" />
            <CommandPrimitive.Input
              value={termo}
              onValueChange={setTermo}
              placeholder="Buscar ação, tela ou compra…"
              className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-muted"
            />
            <Kbd className="bg-soft">Esc</Kbd>
          </div>
          <CommandPrimitive.List className="max-h-[400px] overflow-y-auto pt-2">
            <CommandPrimitive.Empty className="px-4 py-8 text-center text-sm text-ink-muted">
              Nada encontrado para “{termo.trim()}”
            </CommandPrimitive.Empty>
            {grupos.map(
              ([nome, lista]) =>
                lista.length > 0 && (
                  <CommandPrimitive.Group key={nome} heading={nome} className={CLASSE_DO_GRUPO}>
                    {lista.map((c) => (
                      <Item
                        key={c.id}
                        valor={c.id}
                        icone={c.icone}
                        teclas={c.teclas}
                        onSelect={rodar(c.executar)}
                      >
                        {c.rotulo}
                      </Item>
                    ))}
                  </CommandPrimitive.Group>
                ),
            )}
            {achadas.length > 0 && (
              <CommandPrimitive.Group heading="Lançamentos" className={CLASSE_DO_GRUPO}>
                {achadas.map((c) => (
                  <Item
                    key={c.id}
                    valor={`compra-${String(c.id)}`}
                    icone={Receipt}
                    onSelect={rodar(() => {
                      editarCompra(c.id);
                    })}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.descricao}</span>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {dataLonga(c.dataCompra)}
                    </span>
                    <span className="w-24 text-right tabular-nums">
                      {formatarMoeda(c.valorTotal)}
                    </span>
                  </Item>
                ))}
              </CommandPrimitive.Group>
            )}
          </CommandPrimitive.List>
          <p className="border-t px-4 py-2 text-xs text-ink-muted">
            ↑↓ navegar · Enter abrir · Esc fechar
          </p>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
