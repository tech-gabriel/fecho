import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CompraGravada } from '@/data';
import { executar } from '@/features/cadastros/SecaoCadastro';
import {
  entradaDaCompra,
  FormularioDeCompra,
  useDadosDoFormulario,
  type CompraDoFormulario,
} from './NovaCompra';

export function EditarCompra() {
  const compraId = useApp((s) => s.compraEmEdicao);
  const fechar = useApp((s) => s.fecharEdicao);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const repos = useRepositorios();
  const [compra, setCompra] = useState<CompraGravada | null>(null);
  const dados = useDadosDoFormulario(compra !== null, compra ?? undefined);

  useEffect(() => {
    if (compraId === null) return;
    let montado = true;
    void repos.compras.buscar(compraId).then((encontrada) => {
      if (montado) setCompra(encontrada);
    });
    return () => {
      montado = false;
      setCompra(null);
    };
  }, [compraId, repos]);

  const salvar = async (nova: CompraDoFormulario) => {
    if (!compra) return;
    const mesmasParcelas =
      nova.valorTotal === compra.valorTotal &&
      nova.numParcelas === compra.numParcelas &&
      nova.dataCompra === compra.dataCompra &&
      nova.cartaoId === compra.cartaoId;
    await repos.compras.substituir(
      compra.id,
      nova,
      mesmasParcelas ? { parcelas: compra.parcelas } : undefined,
    );
    dadosMudaram();
    fechar();
    toast.success('Compra atualizada', {
      action: {
        label: 'Desfazer',
        onClick: () =>
          void executar(async () => {
            await repos.compras.substituir(compra.id, compra, { parcelas: compra.parcelas });
            dadosMudaram();
          }),
      },
    });
  };

  return (
    <Sheet
      open={compraId !== null}
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
    >
      <SheetContent className="w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar compra</SheetTitle>
          <SheetDescription>{compra?.descricao ?? 'Carregando…'}</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          {compra && dados && (
            <FormularioDeCompra
              modo="edicao"
              dados={dados}
              inicial={entradaDaCompra(compra)}
              competenciasAtuais={compra.parcelas.map((p) => p.competencia)}
              onSalvar={salvar}
              onCancelar={fechar}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
