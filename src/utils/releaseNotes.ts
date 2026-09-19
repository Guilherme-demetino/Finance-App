import type { Release } from "../constants/changelog";

/** Máximo de atualizações listadas de uma vez, pra quem ficou muito tempo sem abrir o app. */
const MAX_RELEASES_SHOWN = 5;

/**
 * Novidades que o usuário ainda não viu, da mais nova pra mais antiga.
 * `lastSeenId` nulo (nunca viu nenhuma) mostra todas.
 */
export function getUnseenReleases(
  changelog: Release[],
  lastSeenId: number | null,
): Release[] {
  return changelog
    .filter((release) => lastSeenId === null || release.id > lastSeenId)
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_RELEASES_SHOWN);
}

/** Lê o id salvo no banco; qualquer coisa que não seja um número vira "nunca viu". */
export function parseLastSeenId(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}
