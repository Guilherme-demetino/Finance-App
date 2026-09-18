import { parseDateString } from "./dates";

/** Percentual guardado da meta, de 0 a 100 (0 quando a meta é inválida). */
export function savingsProgress(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (saved / target) * 100));
}

/**
 * Meses que faltam até o prazo (no mínimo 1). `isOverdue` fica true quando
 * o prazo já passou.
 */
export function monthsUntilDeadline(
  deadline: string,
  today: Date = new Date(),
): { monthsLeft: number; isOverdue: boolean } {
  const end = parseDateString(deadline);
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const isOverdue = end.getTime() < todayStart.getTime();
  const months =
    (end.getFullYear() - today.getFullYear()) * 12 +
    (end.getMonth() - today.getMonth());

  return { monthsLeft: Math.max(1, months), isOverdue };
}

/**
 * Quanto guardar por mês pra chegar na meta no prazo. Retorna null quando
 * não há prazo, a meta já foi batida ou o prazo passou.
 */
export function monthlyDepositNeeded(
  saved: number,
  target: number,
  deadline: string | null,
  today: Date = new Date(),
): number | null {
  const remaining = target - saved;
  if (!deadline || remaining <= 0) return null;

  const { monthsLeft, isOverdue } = monthsUntilDeadline(deadline, today);
  if (isOverdue) return null;

  return Math.ceil((remaining / monthsLeft) * 100) / 100;
}
