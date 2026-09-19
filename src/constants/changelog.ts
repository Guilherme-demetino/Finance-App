export interface Release {
  /** Número crescente: cada atualização nova ganha o próximo. */
  id: number;
  /** DD/MM/AAAA */
  date: string;
  title: string;
  /** O que mudou, escrito pro usuário (sem jargão técnico). */
  items: string[];
}

/**
 * Histórico de novidades mostrado num pop-up ao abrir o dashboard depois de
 * uma atualização. Mais novas por último. Toda atualização publicada deve
 * ganhar uma entrada aqui, senão o usuário não é avisado.
 */
export const CHANGELOG: Release[] = [
  {
    id: 1,
    date: "19/09/2026",
    title: "Pix, extrato do Banco do Brasil e avisos de novidades",
    items: [
      "Nova categoria fixa “Pix”, em receitas e despesas, com cor própria.",
      "Ao importar um extrato, Pix e transferências entram na categoria Pix.",
      "Agora dá para importar o extrato em PDF do Banco do Brasil.",
      "O nome do seu perfil aparece por completo no topo da tela.",
      "O app passa a avisar aqui o que mudou a cada atualização.",
    ],
  },
  {
    id: 2,
    date: "19/09/2026",
    title: "Extrato do Santander",
    items: [
      "Agora dá para importar o extrato em PDF do Santander.",
      "Guardar e resgatar da poupança não entram como receita ou despesa.",
    ],
  },
  {
    id: 3,
    date: "19/09/2026",
    title: "Importar planilhas do Excel",
    items: [
      "Agora dá para importar extratos em planilha do Excel (.xlsx e .xls), pelo mesmo botão de importar.",
      "Também funciona com o backup do app salvo como Excel.",
    ],
  },
  {
    id: 4,
    date: "19/09/2026",
    title: "Extrato do Mercado Pago",
    items: ["Agora dá para importar o extrato em PDF do Mercado Pago."],
  },
  {
    id: 5,
    date: "19/09/2026",
    title: "Ajustes internos",
    items: [
      "Melhorias na forma como as telas carregam os dados, para evitar atualizações desnecessárias.",
      "Ao abrir uma nova transação, os campos agora começam vazios, sem sobrar o texto de uma edição ou de um cadastro cancelado.",
    ],
  },
  {
    id: 6,
    date: "19/09/2026",
    title: "Mais fluidez",
    items: [
      "Digitar na busca e no formulário de transação ficou mais leve, porque as outras telas deixam de ser redesenhadas a cada letra.",
      "O painel carrega só as transações do ano (e dos dois meses comparados) em vez do histórico inteiro.",
      "A lista de últimas transações da tela inicial não é mais filtrada pelo texto da busca do histórico.",
    ],
  },
  {
    id: 7,
    date: "19/09/2026",
    title: "Recorrências e parcelamentos",
    items: [
      "Séries recorrentes e parceladas passam a ser localizadas por um índice no banco, para continuarem rápidas quando o histórico crescer.",
    ],
  },
  {
    id: 8,
    date: "19/09/2026",
    title: "Ajustes internos",
    items: [
      "Os erros tratados pelo app passam a ser registrados num único lugar, o que facilita diagnosticar problemas.",
    ],
  },
];
