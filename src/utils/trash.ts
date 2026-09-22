/**
 * Exclusão com prazo: apagar uma transação só a marca como excluída (`deleted_at`, um timestamp ISO). Ela some das
 * listas na hora, mas fica na Lixeira por alguns dias, dando para desfazer um "apaguei sem querer" antes de sumir de
 * vez (ver database/transactions.ts).
 */

/** Quantos dias uma transação excluída fica na Lixeira antes de ser apagada de vez. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias completos desde que foi excluída (0 = hoje mesmo). */
export function daysSinceDeleted(deletedAt: string, today: Date = new Date()): number {
  const deleted = new Date(deletedAt);
  return Math.max(0, Math.floor((today.getTime() - deleted.getTime()) / DAY_MS));
}

/** Dias que faltam para sumir de vez da Lixeira (pode vir negativo se já passou do prazo e ainda não foi limpa). */
export function daysUntilPurge(deletedAt: string, today: Date = new Date()): number {
  return TRASH_RETENTION_DAYS - daysSinceDeleted(deletedAt, today);
}

/** Já passou do prazo e deveria ter sumido de vez (a limpeza roda ao abrir o app; isso cobre o meio-tempo). */
export function isPastRetention(deletedAt: string, today: Date = new Date()): boolean {
  return daysUntilPurge(deletedAt, today) <= 0;
}

/** "Some em 3 dias" / "Some hoje" / "Deveria ter sumido" — pro item da Lixeira. */
export function describeTimeLeft(deletedAt: string, today: Date = new Date()): string {
  const days = daysUntilPurge(deletedAt, today);
  if (days < 0) return "Deveria ter sumido"; // a limpeza ainda não rodou desta vez
  if (days === 0) return "Some hoje";
  if (days === 1) return "Some amanhã";
  return `Some em ${days} dias`;
}
