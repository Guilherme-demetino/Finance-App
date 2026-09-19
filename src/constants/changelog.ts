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
  {
    id: 9,
    date: "19/09/2026",
    title: "Painel mais leve",
    items: [
      "O painel foi reorganizado por áreas (transações, orçamento, dívidas, metas e perfil): abrir menus, avisos e modais agora redesenha bem menos partes da tela.",
    ],
  },
  {
    id: 10,
    date: "19/09/2026",
    title: "Correção ao zerar o app",
    items: [
      "Depois de zerar o app, cadastrar o nome de novo dava erro e só funcionava depois de fechar e abrir o app. Agora funciona direto.",
    ],
  },
  {
    id: 11,
    date: "19/09/2026",
    title: "PIN mais seguro",
    items: [
      "Depois de 5 PINs errados seguidos, o app bloqueia a digitação por um tempo que cresce a cada novo erro (30 segundos, 1, 5 e 15 minutos, até 1 hora).",
      "O bloqueio continua valendo mesmo que você feche e abra o app, e a contagem só zera quando o PIN certo é digitado.",
      "O desbloqueio por digital continua funcionando durante o bloqueio do PIN.",
    ],
  },
  {
    id: 12,
    date: "19/09/2026",
    title: "Backup completo e restauração",
    items: [
      "Novo “Backup Completo (arquivo)” no menu do perfil: salva transações, categorias, orçamentos, metas por categoria, dívidas, metas de economia e o nome num único arquivo, que você pode guardar no Drive ou enviar para si mesmo.",
      "Novo “Restaurar Backup”: lê o arquivo, mostra o que há nele e o que há no app agora e, só se você confirmar, substitui tudo. Se algo falhar no meio, nada é alterado.",
      "O PIN e a foto do perfil não entram no backup.",
      "O item “Exportar Backup (CSV)” agora se chama “Exportar Transações (CSV)”, porque leva só as transações.",
    ],
  },
  {
    id: 13,
    date: "19/09/2026",
    title: "Backup automático",
    items: [
      "Novo “Backup Automático” no menu do perfil: escolha uma pasta (pode ser do Google Drive) e o app salva ali um backup completo, no máximo uma vez por dia, quando você abre o app. Ficam os 30 mais recentes.",
      "Ao escolher a pasta o app já faz um backup para você ver na hora se ela aceita gravar. Se um dia a pasta deixar de funcionar, o app avisa.",
      "Quem não ativou nenhum backup recebe, de vez em quando, um lembrete de que os dados ficam só neste aparelho.",
      "O menu do perfil agora rola quando não cabe na tela.",
    ],
  },
];
