import releases from "./changelog.json";

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
 * Histórico de novidades, mostrado num pop-up ao abrir o dashboard depois de
 * uma atualização e na tela "Atualizações". Mais novas por último.
 *
 * Os dados ficam em changelog.json (é o arquivo que se edita a cada release):
 * o app.config.js lê o mesmo arquivo e embute as últimas novidades em cada
 * atualização publicada, para a tela "Atualizações" poder mostrar o que mudou
 * antes de baixar. Toda atualização publicada deve ganhar uma entrada lá,
 * senão o usuário não é avisado.
 */
export const CHANGELOG: Release[] = releases;
