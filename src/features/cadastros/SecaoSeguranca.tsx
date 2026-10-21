import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { OPCOES_DE_BLOQUEIO, validarPin } from '@/domain/seguranca';
import { DialogDeSenha } from '@/features/seguranca/DialogDeSenha';
import { executar } from './SecaoCadastro';

type Dialogo = 'ligar' | 'desligar' | 'trocar' | null;

const novoPinValido = (pin: string, confirmacao: string) => {
  if (!validarPin(pin)) return 'O PIN tem 4 dígitos.';
  if (pin !== confirmacao) return 'Os PINs não são iguais.';
  return null;
};

export function SecaoSeguranca() {
  const id = useId();
  const repos = useRepositorios();
  const pinAtivo = useApp((s) => s.pinAtivo);
  const definirPinAtivo = useApp((s) => s.definirPinAtivo);
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [minutos, setMinutos] = useState<number | null | undefined>(undefined);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  useEffect(() => {
    let montado = true;
    void repos.preferencias.ler().then((p) => {
      if (montado) setMinutos(p.bloquearAposMinutos);
    });
    return () => {
      montado = false;
    };
  }, [repos]);

  const fechar = () => {
    setDialogo(null);
  };

  return (
    <section
      id="seguranca"
      aria-labelledby="seguranca-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="seguranca-titulo" className="text-base font-semibold">
        Segurança
      </h2>

      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <Label htmlFor={`${id}-pin`} className="text-sm">
            Pedir PIN
          </Label>
          <span className="text-[13px] text-ink-muted">
            Ao abrir o Fechô, com Ctrl+L e depois de um tempo sem uso
          </span>
        </div>
        <Switch
          id={`${id}-pin`}
          checked={pinAtivo}
          onCheckedChange={(ligar) => {
            setDialogo(ligar ? 'ligar' : 'desligar');
          }}
        />
      </div>

      {pinAtivo && (
        <>
          <div className="flex items-center gap-4 border-t pt-4">
            <Label htmlFor={`${id}-minutos`} className="flex-1 text-sm">
              Bloquear depois de
            </Label>
            {minutos !== undefined && (
              <Select
                value={minutos === null ? 'nunca' : String(minutos)}
                onValueChange={(valor) =>
                  void executar(async () => {
                    const novo = valor === 'nunca' ? null : Number(valor);
                    await repos.preferencias.gravar({ bloquearAposMinutos: novo });
                    setMinutos(novo);
                    dadosMudaram();
                    toast.success(
                      novo === null
                        ? 'O Fechô não bloqueia mais sozinho'
                        : `Bloqueia depois de ${String(novo)} ${novo === 1 ? 'minuto' : 'minutos'} sem uso`,
                    );
                  })
                }
              >
                <SelectTrigger id={`${id}-minutos`} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_DE_BLOQUEIO.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? 'minuto' : 'minutos'} sem uso
                    </SelectItem>
                  ))}
                  <SelectItem value="nunca">Nunca</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDialogo('trocar');
              }}
            >
              Trocar PIN
            </Button>
          </div>
        </>
      )}

      <DialogDeSenha
        aberto={dialogo === 'ligar'}
        titulo="Defina um PIN"
        descricao="4 números que você vai digitar para abrir o Fechô."
        campos={[
          { rotulo: 'PIN', tipo: 'pin' },
          { rotulo: 'Repita o PIN', tipo: 'pin' },
        ]}
        confirmar="Ligar PIN"
        onFechar={fechar}
        onConfirmar={async ([pin = '', confirmacao = '']) => {
          const erro = novoPinValido(pin, confirmacao);
          if (erro) return erro;
          await repos.seguranca.definirPin(pin);
          definirPinAtivo(true);
          fechar();
          toast.success('PIN ligado. Ctrl+L bloqueia na hora.');
          return null;
        }}
      />
      <DialogDeSenha
        aberto={dialogo === 'desligar'}
        titulo="Desligar o PIN"
        descricao="Digite o PIN atual para o Fechô deixar de pedir."
        campos={[{ rotulo: 'PIN atual', tipo: 'pin' }]}
        confirmar="Desligar"
        onFechar={fechar}
        onConfirmar={async ([pin = '']) => {
          if (!(await repos.seguranca.removerPin(pin))) return 'PIN errado.';
          definirPinAtivo(false);
          fechar();
          toast.success('O Fechô não pede mais PIN');
          return null;
        }}
      />
      <DialogDeSenha
        aberto={dialogo === 'trocar'}
        titulo="Trocar PIN"
        descricao="Digite o PIN atual e o novo duas vezes."
        campos={[
          { rotulo: 'PIN atual', tipo: 'pin' },
          { rotulo: 'Novo PIN', tipo: 'pin' },
          { rotulo: 'Repita o novo PIN', tipo: 'pin' },
        ]}
        confirmar="Trocar"
        onFechar={fechar}
        onConfirmar={async ([atual = '', pin = '', confirmacao = '']) => {
          if (!(await repos.seguranca.conferirPin(atual))) return 'O PIN atual está errado.';
          const erro = novoPinValido(pin, confirmacao);
          if (erro) return erro;
          await repos.seguranca.definirPin(pin);
          fechar();
          toast.success('PIN trocado');
          return null;
        }}
      />
    </section>
  );
}
