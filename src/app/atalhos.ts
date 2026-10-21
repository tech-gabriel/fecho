export interface Atalho {
  acao: string;
  teclas: string[];
}

export const GRUPOS_DE_ATALHOS: { grupo: string; atalhos: Atalho[] }[] = [
  {
    grupo: 'Geral',
    atalhos: [
      { acao: 'Comandos e busca', teclas: ['Ctrl+K'] },
      { acao: 'Nova compra', teclas: ['Ctrl+N'] },
      { acao: 'Registrar depósito', teclas: ['Ctrl+R'] },
      { acao: 'Desfazer a última ação', teclas: ['Ctrl+Z'] },
      { acao: 'Atalhos', teclas: ['?'] },
      { acao: 'Bloquear', teclas: ['Ctrl+L'] },
      { acao: 'Recolher a barra lateral', teclas: ['Ctrl+B'] },
      { acao: 'Configurações', teclas: ['Ctrl+,'] },
    ],
  },
  {
    grupo: 'Navegação',
    atalhos: [
      { acao: 'Ir para uma tela', teclas: ['Ctrl+1…8'] },
      { acao: 'Mês anterior / próximo', teclas: ['Ctrl+←', 'Ctrl+→'] },
      { acao: 'Mês atual', teclas: ['Ctrl+Home'] },
      { acao: 'Tela anterior', teclas: ['Alt+←'] },
    ],
  },
  {
    grupo: 'Tabelas',
    atalhos: [
      { acao: 'Andar pelas linhas', teclas: ['↑', '↓'] },
      { acao: 'Selecionar', teclas: ['Espaço'] },
      { acao: 'Selecionar um intervalo', teclas: ['Shift+clique'] },
      { acao: 'Selecionar tudo', teclas: ['Ctrl+A'] },
      { acao: 'Editar a descrição', teclas: ['F2'] },
      { acao: 'Duplicar', teclas: ['Ctrl+D'] },
      { acao: 'Excluir', teclas: ['Del'] },
      { acao: 'Filtrar', teclas: ['Ctrl+F'] },
    ],
  },
  {
    grupo: 'Formulários',
    atalhos: [
      { acao: 'Salvar', teclas: ['Enter'] },
      { acao: 'Salvar e abrir outra', teclas: ['Shift+Enter'] },
      { acao: 'Mais opções', teclas: ['Alt+M'] },
      { acao: 'Fechar', teclas: ['Esc'] },
    ],
  },
  {
    grupo: 'Fechar o mês',
    atalhos: [
      { acao: 'Próxima etapa', teclas: ['Ctrl+Enter'] },
      { acao: 'Conferir a fatura', teclas: ['Espaço'] },
      { acao: 'Marcar a fatura como paga', teclas: ['P'] },
    ],
  },
  {
    grupo: 'A receber',
    atalhos: [
      { acao: 'Copiar a cobrança', teclas: ['Ctrl+Shift+C'] },
      { acao: 'Registrar o depósito total', teclas: ['Ctrl+Enter'] },
    ],
  },
];
