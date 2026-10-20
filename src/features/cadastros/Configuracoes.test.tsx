import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriosProvider } from '@/app/repositorios';
import { rotas } from '@/app/router';
import { criarRepositoriosEmMemoria } from '@/data/memory';
import type { Repositorios } from '@/data';

let repos: Repositorios;

async function abrir() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/configuracoes'] });
  render(
    <RepositoriosProvider criar={() => Promise.resolve(repos)}>
      <RouterProvider router={router} />
    </RepositoriosProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Configurações' });
}

const secao = (nome: string) => screen.getByRole('region', { name: nome });

function preencher(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  repos = criarRepositoriosEmMemoria();
  await repos.cartoes.criar({
    nome: 'Cartão Roxo',
    diaFechamento: 28,
    diaVencimento: 5,
    limiteCentavos: 500_000,
    cor: '#8B5CF6',
    ativo: true,
  });
  await repos.terceiros.criar({ nome: 'Ana', cor: '#2563EB', ativo: true });
});

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('Configurações › cadastros', () => {
  it('lista os cartões com fechamento, vencimento e limite', async () => {
    await abrir();

    const linha = await within(secao('Cartões')).findByRole('row', { name: /Cartão Roxo/ });
    expect(linha).toHaveTextContent('Dia 28');
    expect(linha).toHaveTextContent('Dia 05');
    expect(linha).toHaveTextContent('R$ 5.000,00');
  });

  it('cria um cartão pelo Dialog', async () => {
    await abrir();

    fireEvent.click(within(secao('Cartões')).getByRole('button', { name: 'Adicionar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo cartão' });
    preencher('Nome', 'Cartão Azul');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Azul' }));
    preencher('Fecha dia', '3');
    preencher('Vence dia', '10');
    preencher('Limite', '8.000,00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('row', { name: /Cartão Azul/ })).toHaveTextContent(
      'R$ 8.000,00',
    );
    expect(await screen.findByText('Cartão salvo')).toBeInTheDocument();
    expect((await repos.cartoes.listar())[1]).toMatchObject({
      cor: '#3B82F6',
      diaFechamento: 3,
      limiteCentavos: 800_000,
    });
  });

  it('mostra os erros no campo e não salva', async () => {
    await abrir();

    fireEvent.click(within(secao('Cartões')).getByRole('button', { name: 'Adicionar' }));
    const dialog = await screen.findByRole('dialog');
    preencher('Fecha dia', '32');
    preencher('Limite', 'abc');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Digite um nome')).toBeInTheDocument();
    expect(screen.getAllByText('Use um dia de 1 a 31')).toHaveLength(2);
    expect(screen.getByText('Digite um valor como 1.234,56')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(await repos.cartoes.listar()).toHaveLength(1);
  });

  it('exclui um cadastro sem compras e desfaz', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Pessoa excluída')).toBeInTheDocument();
    expect(within(secao('Pessoas')).queryByText('Ana')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(await within(secao('Pessoas')).findByText('Ana')).toBeInTheDocument();
  });

  it('com compras, arquiva em vez de excluir', async () => {
    await repos.compras.salvar({
      cartaoId: 1,
      descricao: 'Tênis',
      categoriaId: null,
      valorTotal: 10_000,
      numParcelas: 1,
      dataCompra: '2026-10-10',
      recorrente: false,
      rateios: [],
    });
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cartão Roxo' }));
    expect(await screen.findByRole('button', { name: 'Arquivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

    expect(await screen.findByText('Cartão arquivado')).toBeInTheDocument();
    expect(within(secao('Cartões')).getByText('Arquivado')).toBeInTheDocument();
  });

  it('mostra a prévia ao mudar o fechamento e move as compras ao confirmar', async () => {
    await repos.compras.salvar({
      cartaoId: 1,
      descricao: 'Tênis de corrida',
      categoriaId: null,
      valorTotal: 30_000,
      numParcelas: 3,
      dataCompra: '2026-10-26',
      recorrente: false,
      rateios: [],
    });
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cartão Roxo' }));
    await screen.findByRole('dialog', { name: 'Cartão Roxo' });
    preencher('Fecha dia', '25');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    const previa = await screen.findByRole('dialog', { name: '1 compra muda de fatura' });
    expect(previa).toHaveTextContent('Tênis de corrida');
    expect(previa).toHaveTextContent('Outubro 2026');
    expect(previa).toHaveTextContent('Novembro 2026');
    fireEvent.click(within(previa).getByRole('button', { name: 'Salvar e mover 1 compra' }));

    expect(await screen.findByText('Cartão salvo')).toBeInTheDocument();
    expect(await repos.compras.parcelasDaCompetencia('2026-10')).toEqual([]);
    expect((await repos.cartoes.listar())[0]?.diaFechamento).toBe(25);
  });

  it('salva direto quando nenhuma compra muda de fatura', async () => {
    await abrir();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cartão Roxo' }));
    await screen.findByRole('dialog', { name: 'Cartão Roxo' });
    preencher('Fecha dia', '20');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Cartão salvo')).toBeInTheDocument();
    expect((await repos.cartoes.listar())[0]?.diaFechamento).toBe(20);
  });

  it('cria uma categoria com ícone', async () => {
    await abrir();

    fireEvent.click(within(secao('Categorias')).getByRole('button', { name: 'Adicionar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova categoria' });
    preencher('Nome', 'Pet');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Pet' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Categoria salva')).toBeInTheDocument();
    expect(await repos.categorias.listar()).toEqual([
      { id: 1, nome: 'Pet', icone: 'paw-print', ativo: true },
    ]);
  });

  it('avisa quando salvar falha', async () => {
    vi.spyOn(repos.terceiros, 'criar').mockRejectedValueOnce(new Error('disco cheio'));
    await abrir();

    fireEvent.click(within(secao('Pessoas')).getByRole('button', { name: 'Adicionar' }));
    await screen.findByRole('dialog', { name: 'Nova pessoa' });
    preencher('Nome', 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Não foi possível salvar.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('row', { name: /Bruno/ })).toBeInTheDocument();
  });
});
