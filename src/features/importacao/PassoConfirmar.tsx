import { useId } from 'react';
import { CircleCheck } from 'lucide-react';
import { Kbd } from '@/app/layout/apoio';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CompraImportada } from '@/domain/importacao';
import { nomeDoMes } from '@/lib/formato';

const lista = (nomes: string[]) =>
  nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1) ?? ''}`;

function Opcao({
  titulo,
  descricao,
  ligada,
  onMudar,
}: {
  titulo: string;
  descricao: string;
  ligada: boolean;
  onMudar: (ligada: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 border-t px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <Label htmlFor={id} className="text-sm">
          {titulo}
        </Label>
        <span className="text-[13px] text-ink-muted">{descricao}</span>
      </div>
      <Switch id={id} checked={ligada} onCheckedChange={onMudar} />
    </div>
  );
}

export function PassoConfirmar({
  compras,
  novosCartoes,
  novasPessoas,
  criarPessoas,
  sugerirCategorias,
  temColunaDeCategoria,
  estado,
  resultado,
  onCriarPessoas,
  onSugerirCategorias,
}: {
  compras: CompraImportada[];
  novosCartoes: string[];
  novasPessoas: string[];
  criarPessoas: boolean;
  sugerirCategorias: boolean;
  temColunaDeCategoria: boolean;
  estado: 'pronto' | 'importando' | 'feito';
  resultado: { compras: number; parcelas: number; pessoas: number };
  onCriarPessoas: (ligada: boolean) => void;
  onSugerirCategorias: (ligada: boolean) => void;
}) {
  if (estado === 'feito') {
    return (
      <div role="status" className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-bg">
          <CircleCheck size={28} strokeWidth={1.75} aria-hidden className="text-success" />
        </span>
        <p className="text-base">
          {resultado.compras} compras, {resultado.parcelas} parcelas
          {resultado.pessoas > 0 ? ` e ${resultado.pessoas} pessoas` : ''} entraram no Fechô.
        </p>
        <p className="text-sm text-ink-muted">
          Dica: aperte <Kbd className="bg-soft">Ctrl N</Kbd> em qualquer tela para registrar uma
          compra.
        </p>
      </div>
    );
  }

  const datas = compras.map((c) => c.dataCompra).sort();
  const primeira = datas[0];
  const ultima = datas.at(-1);
  const periodo =
    primeira && ultima
      ? primeira.slice(0, 7) === ultima.slice(0, 7)
        ? nomeDoMes(primeira.slice(0, 7))
        : `de ${nomeDoMes(primeira.slice(0, 7))} a ${nomeDoMes(ultima.slice(0, 7))}`
      : '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col rounded-lg border">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">
              {compras.length} {compras.length === 1 ? 'compra' : 'compras'}
            </span>
            <span className="text-[13px] text-ink-muted">
              Compradas {periodo}
              {novosCartoes.length > 0 ? ` · cartões novos: ${lista(novosCartoes)}` : ''}
            </span>
          </div>
        </div>
        {novasPessoas.length > 0 && (
          <Opcao
            titulo="Criar as pessoas encontradas"
            descricao={`${lista(novasPessoas)} entram em Configurações › Pessoas. Desligado, essas compras ficam como suas.`}
            ligada={criarPessoas}
            onMudar={onCriarPessoas}
          />
        )}
        {!temColunaDeCategoria && (
          <Opcao
            titulo="Sugerir categorias"
            descricao="Pelas descrições; dá para mudar depois"
            ligada={sugerirCategorias}
            onMudar={onSugerirCategorias}
          />
        )}
      </div>

      {estado === 'importando' && (
        <div role="status" className="flex flex-col gap-2">
          <span className="text-sm">Importando e gerando as parcelas…</span>
          <div className="h-2 overflow-hidden rounded-full bg-soft">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
          </div>
        </div>
      )}
    </div>
  );
}
