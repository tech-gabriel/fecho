import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { useApp } from '@/app/store';
import { Input } from '@/components/ui/input';
import { atributosDeErro, Campo } from './Campo';
import { executar } from './SecaoCadastro';

export function SecaoPlanejamento() {
  const id = useId();
  const repos = useRepositorios();
  const dadosMudaram = useApp((s) => s.dadosMudaram);
  const [salvo, setSalvo] = useState<number | null>(null);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    let montado = true;
    void repos.preferencias.ler().then(({ limiteRendaComprometida }) => {
      if (!montado) return;
      setSalvo(limiteRendaComprometida);
      setTexto(String(limiteRendaComprometida));
    });
    return () => {
      montado = false;
    };
  }, [repos]);

  const valor = Number(texto);
  const erro =
    Number.isInteger(valor) && valor >= 1 && valor <= 100 ? undefined : 'Use um número de 1 a 100';

  const salvar = () => {
    if (erro || valor === salvo) return;
    void executar(async () => {
      await repos.preferencias.gravar({ limiteRendaComprometida: valor });
      setSalvo(valor);
      dadosMudaram();
      toast.success('Limite salvo');
    });
  };

  return (
    <section
      id="planejamento"
      aria-labelledby="planejamento-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="planejamento-titulo" className="text-base font-semibold">
        Planejamento
      </h2>
      {salvo !== null && (
        <Campo
          id={`${id}-limite`}
          rotulo="Limite de renda comprometida"
          erro={erro}
          dica="Mostra uma linha no gráfico do Dashboard."
        >
          <div className="relative w-28">
            <Input
              {...atributosDeErro(`${id}-limite`, erro)}
              inputMode="numeric"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
              }}
              onBlur={salvar}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvar();
              }}
              className="pr-8 text-right tabular-nums"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-muted"
            >
              %
            </span>
          </div>
        </Campo>
      )}
    </section>
  );
}
