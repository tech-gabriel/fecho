import { entradaDeInteiro } from '@/lib/entrada';
import { useId, useState, type ReactNode } from 'react';
import {
  CircleCheck,
  CreditCard,
  Layers,
  ShoppingBag,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  lerData,
  lerValor,
  type CompraImportada,
  type LinhaLida,
  type Problema,
} from '@/domain/importacao';
import { formatarMoeda } from '@/lib/formato';
import type { Revisao } from './Importacao';

type MudarRevisao = (mudanca: (atual: Revisao) => Partial<Revisao>) => void;

const dataCurta = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

function nomeDoDono(compra: CompraImportada) {
  const { dono } = compra;
  if (dono.tipo === 'pessoa') return dono.nome;
  if (dono.tipo === 'varias') return [...dono.nomes, ...(dono.incluiMeu ? ['eu'] : [])].join(' e ');
  return dono.tipo === 'recorrente' ? 'Meu · recorrente' : 'Meu';
}

function Kpi({
  icone,
  rotulo,
  valor,
  legenda,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: string;
  legenda: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <span className="flex items-center gap-2 text-[13px] text-ink-muted">
        {icone}
        {rotulo}
      </span>
      <span className="text-xl font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-ink-muted">{legenda}</span>
    </div>
  );
}

function CampoDeCorrecao({
  rotulo,
  placeholder,
  ler,
  acao,
  onUsar,
}: {
  rotulo: string;
  placeholder: string;
  ler: (texto: string) => unknown;
  acao: string;
  onUsar: (texto: string) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const invalido = texto !== '' && ler(texto) === null;
  return (
    <span className="flex items-center gap-2">
      <Input
        id={id}
        aria-label={rotulo}
        aria-invalid={invalido ? true : undefined}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
        }}
        className="h-8 w-32"
      />
      <Button
        size="sm"
        variant="outline"
        aria-disabled={texto === '' || invalido ? true : undefined}
        onClick={() => {
          if (texto !== '' && !invalido) onUsar(texto);
        }}
      >
        {acao}
      </Button>
    </span>
  );
}

function DiasDoCartao({
  onCriar,
}: {
  onCriar: (dias: { diaFechamento: number; diaVencimento: number }) => void;
}) {
  const [fecha, setFecha] = useState('');
  const [vence, setVence] = useState('');
  const dia = (texto: string) => {
    const n = Number(texto);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
  };
  const ok = dia(fecha) !== null && dia(vence) !== null;
  return (
    <span className="flex items-center gap-2">
      <Input
        aria-label="Fecha dia"
        placeholder="Fecha dia"
        {...entradaDeInteiro(2)}
        value={fecha}
        onChange={(e) => {
          setFecha(e.target.value);
        }}
        className="h-8 w-24"
      />
      <Input
        aria-label="Vence dia"
        placeholder="Vence dia"
        {...entradaDeInteiro(2)}
        value={vence}
        onChange={(e) => {
          setVence(e.target.value);
        }}
        className="h-8 w-24"
      />
      <Button
        size="sm"
        aria-disabled={ok ? undefined : true}
        onClick={() => {
          const diaFechamento = dia(fecha);
          const diaVencimento = dia(vence);
          if (diaFechamento !== null && diaVencimento !== null)
            onCriar({ diaFechamento, diaVencimento });
        }}
      >
        Criar cartão
      </Button>
    </span>
  );
}

export function PassoPrevia({
  linhas,
  compras,
  problemas,
  duplicadas,
  revisao,
  novosCartoes,
  novasPessoas,
  onRevisao,
}: {
  linhas: LinhaLida[];
  compras: CompraImportada[];
  problemas: Problema[];
  duplicadas: CompraImportada[];
  revisao: Revisao;
  novosCartoes: string[];
  novasPessoas: string[];
  onRevisao: MudarRevisao;
}) {
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const ignorar = (ids: string[]) => {
    onRevisao((a) => ({ ignoradas: [...a.ignoradas, ...ids] }));
  };
  const corrigir = (id: string, correcao: Revisao['correcoes'][string]) => {
    onRevisao((a) => ({
      correcoes: { ...a.correcoes, [id]: { ...a.correcoes[id], ...correcao } },
    }));
  };
  const onde = (id: string) => {
    const l = porId.get(id);
    return l ? `Aba “${l.aba}”, linha ${l.linha}${l.descricao ? ` · ${l.descricao}` : ''}` : '';
  };
  const parcelasGeradas = compras.reduce((s, c) => s + c.numParcelas - c.linhas.length, 0);
  const deTerceiros = compras.filter(
    (c) => c.dono.tipo === 'pessoa' || c.dono.tipo === 'varias',
  ).length;
  const problemasDeLinha = problemas.filter(
    (p) => p.tipo !== 'cartaoNovo' && p.tipo !== 'valoresDiferentes',
  );

  const conteudo = (p: Problema): { titulo: string; detalhe: string; acoes: ReactNode } => {
    const id = p.chave;
    const linha = porId.get(id);
    const botaoIgnorar = (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          ignorar(p.linhas);
        }}
      >
        {p.linhas.length > 1 ? 'Ignorar estas linhas' : 'Ignorar linha'}
      </Button>
    );
    switch (p.tipo) {
      case 'valor':
        return {
          titulo: 'Linha sem valor',
          detalhe: onde(id),
          acoes: (
            <>
              <CampoDeCorrecao
                rotulo="Valor"
                placeholder="0,00"
                ler={lerValor}
                acao="Usar valor"
                onUsar={(t) => {
                  corrigir(id, { valor: lerValor(t) });
                }}
              />
              {botaoIgnorar}
            </>
          ),
        };
      case 'negativo':
        return {
          titulo: 'Valor negativo (estorno ou pagamento?)',
          detalhe: `${onde(id)} · ${formatarMoeda(linha?.valor ?? 0)}`,
          acoes: (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  corrigir(id, { valor: Math.abs(linha?.valor ?? 0) });
                }}
              >
                Usar como positivo
              </Button>
              {botaoIgnorar}
            </>
          ),
        };
      case 'data':
        return {
          titulo: 'Data não reconhecida',
          detalhe: onde(id),
          acoes: (
            <>
              <CampoDeCorrecao
                rotulo="Data"
                placeholder="dd/mm/aaaa"
                ler={lerData}
                acao="Usar data"
                onUsar={(t) => {
                  corrigir(id, { data: lerData(t) });
                }}
              />
              {botaoIgnorar}
            </>
          ),
        };
      case 'parcela':
        return {
          titulo: 'Parcela não reconhecida',
          detalhe: onde(id),
          acoes: (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  corrigir(id, { parcela: null });
                }}
              >
                Importar à vista
              </Button>
              {botaoIgnorar}
            </>
          ),
        };
      case 'divisao':
        return {
          titulo: `Dividida entre ${linha?.dono.tipo === 'varias' ? [...linha.dono.nomes, ...(linha.dono.incluiMeu ? ['você'] : [])].join(' e ') : ''}?`,
          detalhe: onde(id),
          acoes: (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onRevisao((a) => ({ divisoesAceitas: [...a.divisoesAceitas, id] }));
                }}
              >
                Dividir igualmente
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  corrigir(id, { dono: { tipo: 'meu' } });
                }}
              >
                Só minha
              </Button>
              {botaoIgnorar}
            </>
          ),
        };
      case 'valoresDiferentes': {
        const compra = compras.find((c) => c.chave === id);
        const parcela = linha?.valor ?? 0;
        return {
          titulo: 'Parcelas com valores diferentes',
          detalhe: `${onde(id)} · usaremos ${formatarMoeda(parcela)} × ${compra?.numParcelas ?? 0}`,
          acoes: (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onRevisao((a) => ({ valoresAceitos: [...a.valoresAceitos, id] }));
                }}
              >
                Usar esse valor
              </Button>
              {botaoIgnorar}
            </>
          ),
        };
      }
      case 'cartaoNovo':
        return {
          titulo: `Cartão novo: ${id}`,
          detalhe: `${p.linhas.length} ${p.linhas.length === 1 ? 'linha usa' : 'linhas usam'} este cartão. Informe os dias para as parcelas caírem no mês certo.`,
          acoes: (
            <>
              <DiasDoCartao
                onCriar={(dias) => {
                  onRevisao((a) => ({ diasDosNovos: { ...a.diasDosNovos, [id]: dias } }));
                }}
              />
              {botaoIgnorar}
            </>
          ),
        };
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <Kpi
          icone={<ShoppingBag size={16} strokeWidth={1.75} aria-hidden />}
          rotulo="Compras"
          valor={String(compras.length)}
          legenda={`${duplicadas.length} parecem repetidas`}
        />
        <Kpi
          icone={<Layers size={16} strokeWidth={1.75} aria-hidden />}
          rotulo="Parcelas geradas"
          valor={String(parcelasGeradas)}
          legenda="além das que estão na planilha"
        />
        <Kpi
          icone={<UserRound size={16} strokeWidth={1.75} aria-hidden />}
          rotulo="De terceiros"
          valor={String(deTerceiros)}
          legenda={
            novasPessoas.length > 0
              ? `${novasPessoas.length} ${novasPessoas.length === 1 ? 'pessoa nova' : 'pessoas novas'}`
              : 'nenhuma pessoa nova'
          }
        />
        <Kpi
          icone={<CreditCard size={16} strokeWidth={1.75} aria-hidden />}
          rotulo="Cartões"
          valor={String(new Set(compras.map((c) => c.cartao)).size)}
          legenda={
            novosCartoes.length > 0
              ? `${novosCartoes.length} ${novosCartoes.length === 1 ? 'novo' : 'novos'}`
              : 'todos já existem'
          }
        />
      </div>

      <section aria-labelledby="pontos" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="pontos" className="flex items-center gap-2 text-base font-semibold">
            {problemas.length === 0 ? (
              <>
                <CircleCheck size={18} strokeWidth={1.75} aria-hidden className="text-success" />
                Tudo revisado
              </>
            ) : (
              `${problemas.length} ${problemas.length === 1 ? 'ponto para revisar' : 'pontos para revisar'}`
            )}
          </h2>
          {problemasDeLinha.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                ignorar(problemasDeLinha.flatMap((p) => p.linhas));
              }}
            >
              Ignorar todas as linhas com problema
            </Button>
          )}
        </div>
        {problemas.length > 0 && (
          <ul className="flex flex-col rounded-lg border">
            {problemas.map((p) => {
              const { titulo, detalhe, acoes } = conteudo(p);
              return (
                <li
                  key={`${p.tipo}:${p.chave}`}
                  className="flex flex-wrap items-center gap-3 border-t p-4 first:border-t-0"
                >
                  <span className="flex size-8 flex-none items-center justify-center rounded-md bg-warning-bg">
                    <TriangleAlert
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="text-warning-text"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{titulo}</span>
                    <span className="truncate text-xs text-ink-muted">{detalhe}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">{acoes}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {duplicadas.length > 0 && (
        <section aria-labelledby="repetidas" className="flex flex-col gap-3">
          <h2 id="repetidas" className="text-base font-semibold">
            Parecem já estar no Fechô
          </h2>
          <ul className="flex flex-col rounded-lg border">
            {duplicadas.map((c) => {
              const marcada = revisao.forcarDuplicadas.includes(c.chave);
              const id = `duplicada-${c.chave}`;
              return (
                <li
                  key={c.chave}
                  className="flex items-center gap-3 border-t px-4 py-3 text-sm first:border-t-0"
                >
                  <Checkbox
                    id={id}
                    checked={marcada}
                    onCheckedChange={(v) => {
                      onRevisao((a) => ({
                        forcarDuplicadas:
                          v === true
                            ? [...a.forcarDuplicadas, c.chave]
                            : a.forcarDuplicadas.filter((k) => k !== c.chave),
                      }));
                    }}
                  />
                  <label htmlFor={id} className="flex-1">
                    Importar mesmo assim: {dataCurta(c.dataCompra)} · {c.descricao} · {c.cartao}
                  </label>
                  <span className="tabular-nums">{formatarMoeda(c.valorTotal)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="previa-compras" className="flex flex-col gap-3">
        <h2 id="previa-compras" className="text-base font-semibold">
          Prévia das compras
        </h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="h-9 bg-soft text-left text-xs text-ink-muted-on-tint">
                <th scope="col" className="w-28 px-4 font-medium">
                  Data
                </th>
                <th scope="col" className="px-3 font-medium">
                  Descrição
                </th>
                <th scope="col" className="w-36 px-3 font-medium">
                  Cartão
                </th>
                <th scope="col" className="w-24 px-3 font-medium">
                  Parcelas
                </th>
                <th scope="col" className="w-36 px-3 font-medium">
                  De quem
                </th>
                <th scope="col" className="w-32 px-4 text-right font-medium">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {compras.slice(0, 10).map((c) => (
                <tr key={c.chave} className="h-10 border-t">
                  <td className="px-4 text-ink-muted tabular-nums">{dataCurta(c.dataCompra)}</td>
                  <td className="truncate px-3 font-medium">{c.descricao}</td>
                  <td className="truncate px-3">{c.cartao}</td>
                  <td className="px-3 tabular-nums">
                    {c.numParcelas === 1 ? 'À vista' : `${c.numParcelas}×`}
                  </td>
                  <td className="truncate px-3">{nomeDoDono(c)}</td>
                  <td className="px-4 text-right font-medium tabular-nums">
                    {formatarMoeda(c.valorTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {compras.length > 10 && (
            <p className="border-t px-4 py-2 text-xs text-ink-muted">
              e mais {compras.length - 10} compras
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
