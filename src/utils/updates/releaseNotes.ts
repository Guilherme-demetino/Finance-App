import type { Release } from "../../constants/changelog";

/** Sem nenhuma novidade vista (não é alguém que perdeu atualizações), lista só as mais recentes em vez do histórico inteiro. */
const MAX_WHEN_NEVER_SEEN = 5;

/**
 * Novidades que o usuário ainda não viu, da mais nova pra mais antiga. Quem ficou várias atualizações sem abrir o app vê
 * todas de uma vez, num só pop-up. `lastSeenId` nulo (nunca viu nenhuma) mostra só as mais recentes.
 */
export function getUnseenReleases(
  changelog: Release[],
  lastSeenId: number | null,
): Release[] {
  const unseen = changelog
    .filter((release) => lastSeenId === null || release.id > lastSeenId)
    .sort((a, b) => b.id - a.id);
  return lastSeenId === null ? unseen.slice(0, MAX_WHEN_NEVER_SEEN) : unseen;
}

/** Lê o id salvo no banco; qualquer coisa que não seja um número vira "nunca viu". */
export function parseLastSeenId(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}
