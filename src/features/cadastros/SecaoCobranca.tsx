import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRepositorios } from '@/app/repositorios';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Preferencias } from '@/data';
import { mensagemDeCobranca } from '@/domain/receber';
import { Campo } from './Campo';
import { executar } from './SecaoCadastro';

const VARIAVEIS = ['{nome}', '{valor}', '{cartão}', '{vencimento}', '{pix}'];

type Cobranca = Pick<Preferencias, 'modeloCobranca' | 'chavePix'>;

export function SecaoCobranca() {
  const id = useId();
  const repos = useRepositorios();
  const modelo = useRef<HTMLTextAreaElement>(null);
  const [salvo, setSalvo] = useState<Cobranca | null>(null);
  const [atual, setAtual] = useState<Cobranca>({ modeloCobranca: '', chavePix: '' });

  useEffect(() => {
    let montado = true;
    void repos.preferencias.ler().then(({ modeloCobranca, chavePix }) => {
      if (!montado) return;
      setSalvo({ modeloCobranca, chavePix });
      setAtual({ modeloCobranca, chavePix });
    });
    return () => {
      montado = false;
    };
  }, [repos]);

  const salvar = (dados: Cobranca) => {
    if (
      !salvo ||
      dados.modeloCobranca.trim() === '' ||
      (dados.modeloCobranca === salvo.modeloCobranca && dados.chavePix === salvo.chavePix)
    )
      return;
    void executar(async () => {
      await repos.preferencias.gravar(dados);
      setSalvo(dados);
      toast.success('Mensagem de cobrança salva');
    });
  };

  const inserir = (variavel: string) => {
    const campo = modelo.current;
    const texto = atual.modeloCobranca;
    const inicio = campo?.selectionStart ?? texto.length;
    const fim = campo?.selectionEnd ?? texto.length;
    const novo = { ...atual, modeloCobranca: texto.slice(0, inicio) + variavel + texto.slice(fim) };
    setAtual(novo);
    salvar(novo);
  };

  const erro = atual.modeloCobranca.trim() === '' ? 'Escreva a mensagem' : undefined;

  return (
    <section
      id="cobranca"
      aria-labelledby="cobranca-titulo"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border bg-surface px-6 py-4"
    >
      <h2 id="cobranca-titulo" className="text-base font-semibold">
        Mensagem de cobrança
      </h2>
      {salvo && (
        <>
          <Campo
            id={`${id}-modelo`}
            rotulo="Mensagem"
            erro={erro}
            dica="Copiar cobrança, em A receber, troca as variáveis pelos dados de cada pessoa."
          >
            <Textarea
              ref={modelo}
              id={`${id}-modelo`}
              rows={3}
              value={atual.modeloCobranca}
              aria-invalid={erro ? true : undefined}
              onChange={(e) => {
                setAtual({ ...atual, modeloCobranca: e.target.value });
              }}
              onBlur={() => {
                salvar(atual);
              }}
            />
          </Campo>
          <div
            role="group"
            aria-label="Inserir variável"
            className="flex flex-wrap items-center gap-2"
          >
            {VARIAVEIS.map((variavel) => (
              <button
                key={variavel}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  inserir(variavel);
                }}
                className="h-7 rounded-full bg-soft px-3 font-mono text-xs hover:bg-brand-subtle"
              >
                {variavel}
              </button>
            ))}
          </div>
          <Campo id={`${id}-pix`} rotulo="Chave Pix" dica="Entra no lugar de {pix}.">
            <Input
              id={`${id}-pix`}
              className="max-w-80"
              autoComplete="off"
              value={atual.chavePix}
              onChange={(e) => {
                setAtual({ ...atual, chavePix: e.target.value });
              }}
              onBlur={() => {
                salvar(atual);
              }}
            />
          </Campo>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Prévia</span>
            <p className="rounded-md bg-soft px-3 py-2 text-[13px] whitespace-pre-wrap">
              {mensagemDeCobranca(atual.modeloCobranca, {
                nome: 'Ana',
                valor: 'R$ 320,00',
                cartao: 'Cartão Roxo',
                vencimento: '05/11',
                pix: atual.chavePix || 'sua chave Pix',
              })}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
