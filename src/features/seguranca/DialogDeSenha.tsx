import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { atributosDeErro, Campo } from '@/features/cadastros/Campo';

export interface CampoDeSenha {
  rotulo: string;
  tipo: 'pin' | 'senha';
}

export function DialogDeSenha({
  aberto,
  titulo,
  descricao,
  campos,
  confirmar,
  aviso,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  campos: CampoDeSenha[];
  confirmar: string;
  aviso?: ReactNode;
  onFechar: () => void;
  onConfirmar: (valores: string[]) => Promise<string | null>;
}) {
  return (
    <Dialog
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) onFechar();
      }}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {aberto && (
          <Formulario
            campos={campos}
            confirmar={confirmar}
            aviso={aviso}
            onCancelar={onFechar}
            onConfirmar={onConfirmar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  campos,
  confirmar,
  aviso,
  onCancelar,
  onConfirmar,
}: {
  campos: CampoDeSenha[];
  confirmar: string;
  aviso?: ReactNode;
  onCancelar: () => void;
  onConfirmar: (valores: string[]) => Promise<string | null>;
}) {
  const id = useId();
  const [valores, setValores] = useState(() => campos.map(() => ''));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setEnviando(true);
        void onConfirmar(valores).then((mensagem) => {
          setEnviando(false);
          setErro(mensagem);
        });
      }}
      className="flex flex-col gap-4"
    >
      {campos.map((campo, i) => {
        const idDoCampo = `${id}-${String(i)}`;
        const ultimo = i === campos.length - 1;
        return (
          <Campo
            key={campo.rotulo}
            id={idDoCampo}
            rotulo={campo.rotulo}
            erro={ultimo ? (erro ?? undefined) : undefined}
          >
            <Input
              {...atributosDeErro(idDoCampo, ultimo ? (erro ?? undefined) : undefined)}
              type="password"
              autoComplete={campo.tipo === 'pin' ? 'off' : 'new-password'}
              inputMode={campo.tipo === 'pin' ? 'numeric' : undefined}
              maxLength={campo.tipo === 'pin' ? 4 : undefined}
              className={campo.tipo === 'pin' ? 'w-32 tracking-[0.5em] tabular-nums' : undefined}
              value={valores[i] ?? ''}
              onChange={(e) => {
                const valor =
                  campo.tipo === 'pin' ? e.target.value.replace(/\D/g, '') : e.target.value;
                setValores(valores.map((v, j) => (j === i ? valor : v)));
              }}
            />
          </Campo>
        );
      })}
      {aviso}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {confirmar}
        </Button>
      </DialogFooter>
    </form>
  );
}
