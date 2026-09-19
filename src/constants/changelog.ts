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
];
