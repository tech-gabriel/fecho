import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { LogoSimbolo } from '@/components/Logo';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { esperaAte, tentativasRestantes } from '@/domain/seguranca';

const hora = (data: Date) =>
  `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;

export function TelaDeBloqueio() {
  const id = useId();
  const repos = useRepositorios();
  const bloqueio = useApp((s) => s.bloqueio);
  const erros = useApp((s) => s.errosDoPin);
  const esperarAte = useApp((s) => s.esperarAte);
  const desbloquear = useApp((s) => s.desbloquear);
  const errarPin = useApp((s) => s.errarPin);
  const [digitos, setDigitos] = useState('');
  const [conferindo, setConferindo] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [arquivo, setArquivo] = useState('');
  const [minutos, setMinutos] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const esperando = esperarAte !== null && esperarAte > agora;
  const bloqueado = bloqueio !== null;

  useEffect(() => {
    void repos.seguranca.estado().then((e) => {
      setArquivo(e.arquivo);
    });
    void repos.preferencias.ler().then((p) => {
      setMinutos(p.bloquearAposMinutos);
    });
  }, [repos]);

  useEffect(() => {
    if (esperarAte === null) return;
    const tique = () => {
      setAgora(Date.now());
    };
    const primeiro = setTimeout(tique, 0);
    const relogio = setInterval(tique, 1_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(relogio);
    };
  }, [esperarAte]);

  useEffect(() => {
    if (!bloqueado || esperando || conferindo) return;
    campo.current?.focus();
    // Um Dialog do Radix desmontado pelo bloqueio devolve o foco num setTimeout; este vem depois.
    const depois = setTimeout(() => campo.current?.focus(), 0);
    return () => {
      clearTimeout(depois);
    };
  }, [bloqueado, esperando, conferindo]);

  const conferir = async (pin: string) => {
    setConferindo(true);
    const certo = await repos.seguranca.conferirPin(pin);
    setConferindo(false);
    setDigitos('');
    if (certo) {
      desbloquear();
      return;
    }
    const total = erros + 1;
    const ate = esperaAte(total, Date.now());
    setAgora(Date.now());
    errarPin(ate === null ? total : 0, ate);
  };

  if (!bloqueio) return null;

  const segundos = esperando ? Math.ceil((esperarAte - agora) / 1_000) : 0;
  const mensagem = esperando
    ? `Muitas tentativas. Tente de novo em ${String(segundos)}s.`
    : erros > 0
      ? `PIN errado. Você ainda tem ${String(tentativasRestantes(erros))} ${tentativasRestantes(erros) === 1 ? 'tentativa' : 'tentativas'}.`
      : '';
  const motivo =
    bloqueio.motivo === 'inatividade'
      ? `depois de ${String(minutos ?? 5)} minutos sem uso`
      : bloqueio.motivo === 'atalho'
        ? 'pelo botão Bloquear'
        : 'ao abrir o Fechô';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-instrucao`}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center"
    >
      <LogoSimbolo size={48} className="text-brand" />
      <div className="flex flex-col gap-1">
        <h1 id={`${id}-titulo`} className="text-2xl font-bold">
          O Fechô está bloqueado
        </h1>
        <p id={`${id}-instrucao`} className="text-sm text-ink-muted">
          Digite seu PIN de 4 dígitos
        </p>
      </div>

      <div className="relative flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'flex h-14 w-12 items-center justify-center rounded-md border bg-surface text-2xl font-bold',
              erros > 0 && digitos.length === 0 ? 'border-danger' : 'border-border-strong',
              i === digitos.length &&
                !esperando &&
                'outline-2 outline-offset-1 outline-(--focus-ring)',
            )}
          >
            {i < digitos.length ? '•' : ''}
          </span>
        ))}
        <input
          ref={campo}
          aria-label="PIN"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          disabled={esperando || conferindo}
          value={digitos}
          onChange={(e) => {
            const pin = e.target.value.replace(/\D/g, '').slice(0, 4);
            setDigitos(pin);
            if (pin.length === 4) void conferir(pin);
          }}
          className="absolute inset-0 h-full w-full cursor-default opacity-0"
        />
      </div>

      <p aria-live="assertive" className="min-h-5 text-sm text-danger-text">
        {mensagem}
      </p>

      <Collapsible className="flex max-w-md flex-col items-center gap-2">
        <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">
          Esqueci meu PIN
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="transition-transform group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-md bg-soft px-4 py-3 text-left text-[13px] text-ink-muted-on-tint">
          {arquivo ? (
            <>
              Feche o Fechô, apague o arquivo <code className="break-all">{arquivo}</code> e abra de
              novo. Seus dados continuam todos lá; só o PIN deixa de ser pedido.
            </>
          ) : (
            'No navegador, limpe os dados deste site para tirar o PIN.'
          )}
        </CollapsibleContent>
      </Collapsible>

      <p className="absolute bottom-6 text-xs text-ink-muted">
        Bloqueado às {hora(bloqueio.em)} {motivo} · Ctrl+L bloqueia na hora
      </p>
    </div>
  );
}
